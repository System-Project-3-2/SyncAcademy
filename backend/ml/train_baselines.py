import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False
    from sklearn.ensemble import HistGradientBoostingClassifier

try:
    import matplotlib.pyplot as plt
    HAS_PLOT = True
except Exception:
    HAS_PLOT = False


@dataclass
class SplitFrames:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def parse_args():
    parser = argparse.ArgumentParser(description="Train KT baselines (LogReg + XGBoost) with calibration")
    parser.add_argument("--dataset", type=str, default="", help="Path to CSV dataset")
    parser.add_argument("--output", type=str, default="ml/model_registry", help="Model registry output root")
    parser.add_argument("--reports", type=str, default="ml/reports", help="Report output root")
    parser.add_argument("--smoke-test", action="store_true", help="Train on synthetic data for smoke testing")
    return parser.parse_args()


def generate_synthetic_data(n=600):
    rng = np.random.default_rng(42)
    ts = pd.date_range("2025-01-01", periods=n, freq="H")
    topic_ids = rng.choice(["arrays", "trees", "sorting", "db"], size=n)
    students = rng.choice([f"s{i}" for i in range(1, 31)], size=n)

    acc = rng.uniform(0.2, 0.95, size=n)
    hint = rng.uniform(0, 0.8, size=n)
    attempts_before = rng.integers(0, 20, size=n)
    score = np.clip(0.65 * acc - 0.25 * hint + 0.02 * attempts_before + rng.normal(0, 0.1, size=n), 0, 1)
    label = (score > 0.5).astype(int)

    df = pd.DataFrame(
        {
            "studentId": students,
            "courseId": "c1",
            "topicId": topic_ids,
            "questionId": [f"q{i}" for i in range(n)],
            "sourceType": rng.choice(["quiz", "assignment"], size=n),
            "eventType": rng.choice(["question_attempt", "assignment_attempt"], size=n),
            "eventTimestamp": ts.astype(str),
            "label_nextCorrect": label,
            "topic_attempts_total_before": attempts_before,
            "topic_acc_total_before": acc,
            "topic_hint_rate_total_before": hint,
            "topic_weighted_acc_total_before": np.clip(acc - 0.05, 0, 1),
            "topic_trend_slope_before": rng.normal(0, 0.05, size=n),
            "overall_attempts_total_before": rng.integers(0, 40, size=n),
            "overall_acc_total_before": rng.uniform(0.2, 0.95, size=n),
            "days_since_topic_practice": rng.uniform(0, 30, size=n),
            "topic_acc_last_3": np.clip(acc + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_hint_rate_last_3": np.clip(hint + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_weighted_acc_last_3": np.clip(acc - 0.04 + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_avg_time_last_3": rng.uniform(10, 120, size=n),
            "topic_acc_last_5": np.clip(acc + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_hint_rate_last_5": np.clip(hint + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_weighted_acc_last_5": np.clip(acc - 0.03 + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_avg_time_last_5": rng.uniform(10, 140, size=n),
            "topic_acc_last_10": np.clip(acc + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_hint_rate_last_10": np.clip(hint + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_weighted_acc_last_10": np.clip(acc - 0.02 + rng.normal(0, 0.05, size=n), 0, 1),
            "topic_avg_time_last_10": rng.uniform(10, 180, size=n),
        }
    )
    return df


def load_dataset(dataset_path: str, smoke: bool):
    if smoke:
        return generate_synthetic_data()
    if not dataset_path:
        raise ValueError("--dataset is required unless --smoke-test is provided")
    df = pd.read_csv(dataset_path)
    if "label_nextCorrect" not in df.columns:
        raise ValueError("Dataset must contain label_nextCorrect column")
    if "eventTimestamp" not in df.columns:
        raise ValueError("Dataset must contain eventTimestamp column")
    return df


def time_split(df: pd.DataFrame):
    work = df.copy()
    work["eventTimestamp"] = pd.to_datetime(work["eventTimestamp"], errors="coerce")
    work = work.dropna(subset=["eventTimestamp", "label_nextCorrect"]).sort_values("eventTimestamp")

    n = len(work)
    if n < 30:
        raise ValueError("Not enough rows for time split; need at least 30")

    i70 = int(n * 0.7)
    i85 = int(n * 0.85)
    return SplitFrames(
        train=work.iloc[:i70].copy(),
        val=work.iloc[i70:i85].copy(),
        test=work.iloc[i85:].copy(),
    )


def select_features(df: pd.DataFrame):
    drop = {"label_nextCorrect", "eventTimestamp", "questionId"}
    features = [c for c in df.columns if c not in drop]
    categorical = [c for c in features if df[c].dtype == "object"]
    numeric = [c for c in features if c not in categorical]
    return features, categorical, numeric


def make_preprocessor(categorical, numeric):
    num_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    cat_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", num_pipe, numeric),
            ("cat", cat_pipe, categorical),
        ]
    )


def build_models(preprocessor):
    logreg_base = Pipeline(
        steps=[
            ("prep", preprocessor),
            ("model", LogisticRegression(max_iter=400, class_weight="balanced")),
        ]
    )

    if HAS_XGBOOST:
        xgb_model = XGBClassifier(
            n_estimators=240,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
        )
        xgb_name = "xgboost"
    else:
        xgb_model = HistGradientBoostingClassifier(max_depth=6, learning_rate=0.05, random_state=42)
        xgb_name = "xgboost_fallback"

    xgb_base = Pipeline(
        steps=[
            ("prep", preprocessor),
            ("model", xgb_model),
        ]
    )

    return logreg_base, xgb_base, xgb_name


def metric_pack(y_true, y_prob):
    y_prob = np.clip(y_prob, 1e-8, 1 - 1e-8)
    return {
        "auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "logloss": float(log_loss(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
    }


def evaluate_per_topic(df_test, y_prob, model_name):
    out = []
    temp = df_test.copy()
    temp["prob"] = y_prob
    for topic, g in temp.groupby("topicId"):
        if g["label_nextCorrect"].nunique() < 2:
            continue
        m = metric_pack(g["label_nextCorrect"], g["prob"])
        m.update({"model": model_name, "topicId": topic, "rows": int(len(g))})
        out.append(m)
    return pd.DataFrame(out)


def subgroup_metrics(df_test, y_prob, model_name):
    temp = df_test.copy()
    temp["prob"] = y_prob

    subgroups = {
        "cold_start": temp[temp["topic_attempts_total_before"] < 3],
        "sparse_history": temp[temp["overall_attempts_total_before"] < 5],
    }

    rows = []
    for name, grp in subgroups.items():
        if len(grp) < 10 or grp["label_nextCorrect"].nunique() < 2:
            continue
        m = metric_pack(grp["label_nextCorrect"], grp["prob"])
        m.update({"model": model_name, "subgroup": name, "rows": int(len(grp))})
        rows.append(m)
    return pd.DataFrame(rows)


def feature_importance_logreg(model, feature_names):
    clf = model.named_steps["model"]
    prep = model.named_steps["prep"]
    names = prep.get_feature_names_out(feature_names)
    coefs = clf.coef_[0]
    imp = pd.DataFrame({"feature": names, "importance": np.abs(coefs)}).sort_values("importance", ascending=False)
    return imp


def feature_importance_xgb(model, feature_names):
    prep = model.named_steps["prep"]
    names = prep.get_feature_names_out(feature_names)
    estimator = model.named_steps["model"]

    if hasattr(estimator, "feature_importances_"):
        vals = estimator.feature_importances_
    else:
        vals = np.zeros(len(names))

    return pd.DataFrame({"feature": names, "importance": vals}).sort_values("importance", ascending=False)


def calibration_curve_points(y_true, y_prob, bins=10):
    y_true = np.array(y_true)
    y_prob = np.array(y_prob)
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (y_prob >= lo) & (y_prob < hi if i < bins - 1 else y_prob <= hi)
        if mask.sum() == 0:
            continue
        rows.append(
            {
                "bin": i,
                "prob_mean": float(y_prob[mask].mean()),
                "true_rate": float(y_true[mask].mean()),
                "count": int(mask.sum()),
            }
        )
    return pd.DataFrame(rows)


def train_one(base_model, train_df, val_df, test_df, feature_cols, model_name):
    x_train, y_train = train_df[feature_cols], train_df["label_nextCorrect"].astype(int)
    x_val, y_val = val_df[feature_cols], val_df["label_nextCorrect"].astype(int)
    x_test, y_test = test_df[feature_cols], test_df["label_nextCorrect"].astype(int)

    base_model.fit(x_train, y_train)

    calibrated = CalibratedClassifierCV(base_model, method="isotonic", cv="prefit")
    calibrated.fit(x_val, y_val)

    prob_raw = base_model.predict_proba(x_test)[:, 1]
    prob_cal = calibrated.predict_proba(x_test)[:, 1]

    overall_raw = metric_pack(y_test, prob_raw)
    overall_cal = metric_pack(y_test, prob_cal)

    per_topic = evaluate_per_topic(test_df, prob_cal, model_name)
    subgroup = subgroup_metrics(test_df, prob_cal, model_name)

    errors = test_df.copy()
    errors["prob"] = prob_cal
    errors["pred"] = (errors["prob"] >= 0.5).astype(int)
    errors["abs_error"] = np.abs(errors["label_nextCorrect"] - errors["prob"])
    errors = errors.sort_values("abs_error", ascending=False).head(100)

    calib = calibration_curve_points(y_test, prob_cal)

    return {
        "base_model": base_model,
        "calibrated_model": calibrated,
        "overall_raw": overall_raw,
        "overall_calibrated": overall_cal,
        "per_topic": per_topic,
        "subgroup": subgroup,
        "error_slice": errors,
        "calibration_curve": calib,
    }


def maybe_plot(calib_df_a, calib_df_b, report_dir):
    if not HAS_PLOT:
        return None
    out_path = report_dir / "calibration_comparison.png"
    plt.figure(figsize=(8, 6))
    plt.plot([0, 1], [0, 1], "k--", label="perfect")
    plt.plot(calib_df_a["prob_mean"], calib_df_a["true_rate"], marker="o", label="logreg")
    plt.plot(calib_df_b["prob_mean"], calib_df_b["true_rate"], marker="o", label="xgboost")
    plt.xlabel("Predicted probability")
    plt.ylabel("Observed frequency")
    plt.title("Calibration Curve (Test)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()
    return str(out_path)


def main():
    args = parse_args()
    df = load_dataset(args.dataset, args.smoke_test)

    split = time_split(df)
    feature_cols, categorical, numeric = select_features(split.train)
    preprocessor = make_preprocessor(categorical, numeric)

    logreg_base, xgb_base, xgb_name = build_models(preprocessor)

    logreg_res = train_one(
        logreg_base,
        split.train,
        split.val,
        split.test,
        feature_cols,
        "logreg",
    )
    xgb_res = train_one(
        xgb_base,
        split.train,
        split.val,
        split.test,
        feature_cols,
        xgb_name,
    )

    run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    registry_dir = Path(args.output) / run_id
    report_dir = Path(args.reports) / run_id
    registry_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(logreg_res["base_model"], registry_dir / "logreg_base.joblib")
    joblib.dump(logreg_res["calibrated_model"], registry_dir / "logreg_calibrated.joblib")
    joblib.dump(xgb_res["base_model"], registry_dir / f"{xgb_name}_base.joblib")
    joblib.dump(xgb_res["calibrated_model"], registry_dir / f"{xgb_name}_calibrated.joblib")

    fi_logreg = feature_importance_logreg(logreg_res["base_model"], feature_cols)
    fi_xgb = feature_importance_xgb(xgb_res["base_model"], feature_cols)
    fi_logreg.to_csv(report_dir / "feature_importance_logreg.csv", index=False)
    fi_xgb.to_csv(report_dir / f"feature_importance_{xgb_name}.csv", index=False)

    all_per_topic = pd.concat([logreg_res["per_topic"], xgb_res["per_topic"]], ignore_index=True)
    all_subgroup = pd.concat([logreg_res["subgroup"], xgb_res["subgroup"]], ignore_index=True)
    all_per_topic.to_csv(report_dir / "per_topic_metrics.csv", index=False)
    all_subgroup.to_csv(report_dir / "subgroup_metrics.csv", index=False)

    logreg_res["error_slice"].to_csv(report_dir / "error_slice_logreg.csv", index=False)
    xgb_res["error_slice"].to_csv(report_dir / f"error_slice_{xgb_name}.csv", index=False)

    logreg_res["calibration_curve"].to_csv(report_dir / "calibration_curve_logreg.csv", index=False)
    xgb_res["calibration_curve"].to_csv(report_dir / f"calibration_curve_{xgb_name}.csv", index=False)

    plot_path = maybe_plot(logreg_res["calibration_curve"], xgb_res["calibration_curve"], report_dir)

    summary = {
        "run_id": run_id,
        "xgboost_backend": xgb_name,
        "smoke_test": bool(args.smoke_test),
        "split_rows": {
            "train": int(len(split.train)),
            "val": int(len(split.val)),
            "test": int(len(split.test)),
        },
        "overall": {
            "logreg_raw": logreg_res["overall_raw"],
            "logreg_calibrated": logreg_res["overall_calibrated"],
            f"{xgb_name}_raw": xgb_res["overall_raw"],
            f"{xgb_name}_calibrated": xgb_res["overall_calibrated"],
        },
        "artifacts": {
            "registry_dir": str(registry_dir),
            "report_dir": str(report_dir),
            "plot": plot_path,
        },
    }

    with open(report_dir / "run_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    comparison_table = pd.DataFrame(
        [
            {"model": "logreg", **logreg_res["overall_calibrated"]},
            {"model": xgb_name, **xgb_res["overall_calibrated"]},
        ]
    )
    comparison_table.to_csv(report_dir / "model_comparison.csv", index=False)

    print("Baseline training completed")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
