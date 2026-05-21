import { motion, AnimatePresence } from 'framer-motion';

interface NotificationProps {
  message: string;
  show: boolean;
}

export default function Notification({ message, show }: NotificationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="notification"
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}