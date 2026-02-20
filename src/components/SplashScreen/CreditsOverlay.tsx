import { motion } from "framer-motion";

export function CreditsOverlay() {
  return (
    <motion.div
      className="splash-credits-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      role="img"
      aria-label="CREATED BY 流萤白沙 — 此间 TSIAN —"
    >
      <div className="splash-credits-content">
        <p className="splash-credits-line splash-credits-subtitle">
          {"C R E A T E D  B Y"}
        </p>
        <h1 className="splash-credits-line splash-credits-name">流萤白沙</h1>
        <p className="splash-credits-line splash-credits-project">
          {"— 此 间  T S I A N —"}
        </p>
      </div>
    </motion.div>
  );
}
