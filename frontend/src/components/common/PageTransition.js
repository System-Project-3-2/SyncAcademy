import { motion } from 'framer-motion';
import { pageVariants, pageTransition } from '../../utils/motion';

const PageTransition = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    style={{ width: '100%' }}
  >
    {children}
  </motion.div>
);

export default PageTransition;
