import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface FaceCheckInProps {
  onCheckIn: () => Promise<void>;
  lastCheckIn: Date | null;
}

const FaceCheckIn = ({ onCheckIn, lastCheckIn }: FaceCheckInProps) => {
  const { t } = useLanguage();
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onCheckIn();
      setJustCheckedIn(true);
      setTimeout(() => {
        setJustCheckedIn(false);
      }, 3000);
    } catch (error) {
      console.error("Check-in failed", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeSince = () => {
    if (!lastCheckIn) return t("no_checkins_yet");
    const now = new Date();
    const diff = now.getTime() - lastCheckIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}${t("hours_ago")}`;
    if (minutes > 0) return `${minutes}${t("minutes_ago")}`;
    return t("just_now");
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      <AnimatePresence mode="wait">
        {justCheckedIn ? (
          <motion.div
            key="success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="w-52 h-52 rounded-full bg-success flex flex-col items-center justify-center shadow-lg"
          >
            <Check className="w-20 h-20 text-success-foreground" strokeWidth={3} />
            <span className="text-success-foreground text-lg font-bold mt-1">{t("done")}</span>
          </motion.div>
        ) : (
          <motion.button
            key="checkin"
            onClick={handleCheckIn}
            disabled={loading}
            className="relative w-52 h-52 rounded-full bg-success flex flex-col items-center justify-center shadow-lg focus:outline-none focus:ring-4 focus:ring-ring disabled:opacity-80"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-success/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-success/10"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
            {loading ? (
              <div className="w-12 h-12 border-4 border-success-foreground border-t-transparent rounded-full animate-spin mb-2" />
            ) : (
              <CheckCircle2 className="w-16 h-16 text-success-foreground" strokeWidth={2} />
            )}
            <span className="text-success-foreground text-xl font-extrabold mt-2">
              {loading ? "Sending..." : t("checkin")}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <p className="text-muted-foreground text-lg font-semibold">
        {t("last_checkin")}: {getTimeSince()}
      </p>
    </div>
  );
};

export default FaceCheckIn;
