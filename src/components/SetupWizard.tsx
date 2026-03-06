import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { ChevronRight, ChevronLeft, Check, Heart } from "lucide-react";

type Step = "language" | "profile" | "emergency" | "frequency" | "done";

const STEPS: Step[] = ["language", "profile", "emergency", "frequency"];

const GENDERS = [
  { value: "male", labels: { en: "Male", zh: "男", ms: "Lelaki", ta: "ஆண்" } },
  { value: "female", labels: { en: "Female", zh: "女", ms: "Perempuan", ta: "பெண்" } },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", labels: { en: "Every day", zh: "每天", ms: "Setiap hari", ta: "ஒவ்வொரு நாளும்" } },
  { value: "every_2_days", labels: { en: "Every 2 days", zh: "每两天", ms: "Setiap 2 hari", ta: "ஒவ்வொரு 2 நாட்களும்" } },
];

const stepTitles: Record<string, Record<string, string>> = {
  language: { en: "Choose Language", zh: "选择语言", ms: "Pilih Bahasa", ta: "மொழியைத் தேர்ந்தெடுக்கவும்" },
  profile: { en: "About You", zh: "关于您", ms: "Tentang Anda", ta: "உங்களைப் பற்றி" },
  emergency: { en: "Emergency Contact", zh: "紧急联系人", ms: "Hubungan Kecemasan", ta: "அவசர தொடர்பு" },
  frequency: { en: "Check-in Frequency", zh: "签到频率", ms: "Kekerapan Daftar Masuk", ta: "பதிவு அதிர்வெண்" },
  photo: { en: "Your Photo", zh: "您的照片", ms: "Foto Anda", ta: "உங்கள் புகைப்படம்" },
};

const labels: Record<string, Record<string, string>> = {
  next: { en: "Next", zh: "下一步", ms: "Seterusnya", ta: "அடுத்து" },
  back: { en: "Back", zh: "返回", ms: "Kembali", ta: "பின்" },
  name: { en: "Your Name", zh: "您的姓名", ms: "Nama Anda", ta: "உங்கள் பெயர்" },
  year_of_birth: { en: "Year of Birth", zh: "出生年份", ms: "Tahun Lahir", ta: "பிறந்த ஆண்டு" },
  gender: { en: "Gender", zh: "性别", ms: "Jantina", ta: "பாலினம்" },
  emergency_name: { en: "Contact Name", zh: "联系人姓名", ms: "Nama Hubungan", ta: "தொடர்பு பெயர்" },
  emergency_phone: { en: "Contact Phone", zh: "联系电话", ms: "Nombor Telefon", ta: "தொடர்பு எண்" },
  frequency_desc: { en: "How often should you check in?", zh: "您应该多久签到一次？", ms: "Berapa kerap anda perlu daftar masuk?", ta: "எவ்வளவு அடிக்கடி பதிவு செய்ய வேண்டும்?" },
  take_selfie: { en: "Take a selfie", zh: "拍自拍照", ms: "Ambil swafoto", ta: "செல்ஃபி எடுக்கவும்" },
  photo_required: { en: "A profile photo with your face is required", zh: "需要一张有您面部的照片", ms: "Foto profil dengan wajah anda diperlukan", ta: "உங்கள் முகம் உள்ள சுயவிவர புகைப்படம் தேவை" },
  done: { en: "All Set!", zh: "设置完成！", ms: "Selesai!", ta: "முடிந்தது!" },
  finish: { en: "Start Using SafeCheck", zh: "开始使用安全签到", ms: "Mula Guna SafeCheck", ta: "SafeCheck பயன்படுத்தத் தொடங்கு" },
};

const l = (key: string, lang: Language) => labels[key]?.[lang] || labels[key]?.en || key;

const SetupWizard = () => {
  const { user, markSetupComplete } = useAuth();
  const { lang, setLang } = useLanguage();

  const [step, setStep] = useState<Step>("language");
  const [fullName, setFullName] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleFinish = async () => {
    if (!user) return;

    try {
      // Convert year to date
      const dob = yearOfBirth ? `${yearOfBirth}-01-01` : null;

      // Save profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          date_of_birth: dob,
          gender,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Create check-in schedule based on frequency
      const scheduleTimes = ["09:00"];
      const daysOfWeek = frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4, 6];

      const { error: scheduleError } = await supabase.from("check_in_schedules").insert({
        elder_id: user.id,
        schedule_times: scheduleTimes,
        days_of_week: daysOfWeek,
        created_by: user.id,
      });

      if (scheduleError) throw scheduleError;

      // Fetch the link code
      const { data: profileData } = await supabase
        .from("profiles")
        .select("link_code")
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (profileData?.link_code) {
        setLinkCode(profileData.link_code);
      }

      setStep("done");
      // Don't auto-redirect, let them see the code and click a button
    } catch (error) {
      console.error("Error finishing setup:", error);
      // Ideally show a toast here
    }
  };

  const canProceedProfile = fullName.trim().length > 0 && yearOfBirth.length === 4 && gender;
  const canProceedEmergency = true;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 60 }, (_, i) => String(currentYear - 50 - i));

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-2">
            <Heart className="w-7 h-7 text-primary-foreground" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">SafeCheck</h1>
        </div>

        {/* Progress dots */}
        {step !== "done" && (
          <div className="flex justify-center gap-3 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: Language */}
          {step === "language" && (
            <motion.div key="lang" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <h2 className="text-2xl font-extrabold text-foreground text-center mb-6">
                {stepTitles.language[lang] || stepTitles.language.en}
              </h2>
              <div className="space-y-3 mb-8">
                {LANGUAGES.map((lng) => (
                  <button
                    key={lng.code}
                    onClick={() => setLang(lng.code)}
                    className={`w-full rounded-2xl border-3 p-5 text-left transition-all ${
                      lang === lng.code ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card"
                    }`}
                  >
                    <p className="font-extrabold text-card-foreground text-xl">{lng.nativeLabel}</p>
                    <p className="text-muted-foreground text-base">{lng.label}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={goNext}
                className="w-full bg-primary text-primary-foreground font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2"
              >
                {l("next", lang)} <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {/* STEP 2: Profile (Name, Year of Birth, Gender) */}
          {step === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <h2 className="text-2xl font-extrabold text-foreground text-center mb-6">
                {stepTitles.profile[lang] || stepTitles.profile.en}
              </h2>

              <div className="space-y-5 mb-8">
                {/* Name */}
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">{l("name", lang)}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-border bg-card px-5 py-4 text-xl text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Year of Birth */}
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">{l("year_of_birth", lang)}</label>
                  <select
                    value={yearOfBirth}
                    onChange={(e) => setYearOfBirth(e.target.value)}
                    className="w-full rounded-2xl border-2 border-border bg-card px-5 py-4 text-xl text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">—</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">{l("gender", lang)}</label>
                  <div className="flex gap-3">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setGender(g.value)}
                        className={`flex-1 rounded-2xl border-3 p-4 text-center font-bold text-lg transition-all ${
                          gender === g.value ? "border-primary bg-primary/10" : "border-border bg-card"
                        } text-card-foreground`}
                      >
                        {g.labels[lang] || g.labels.en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={goBack} className="px-5 py-4 rounded-2xl border-2 border-border text-foreground font-bold">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={goNext}
                  disabled={!canProceedProfile}
                  className="flex-1 bg-primary text-primary-foreground font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {l("next", lang)} <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Emergency Contact */}
          {step === "emergency" && (
            <motion.div key="emergency" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <h2 className="text-2xl font-extrabold text-foreground text-center mb-2">
                {stepTitles.emergency[lang] || stepTitles.emergency.en}
              </h2>
              <p className="text-muted-foreground text-center mb-6 text-lg">🆘</p>

              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">{l("emergency_name", lang)}</label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-border bg-card px-5 py-4 text-xl text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-lg font-bold text-foreground mb-2">{l("emergency_phone", lang)}</label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full rounded-2xl border-2 border-border bg-card px-5 py-4 text-xl text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={goBack} className="px-5 py-4 rounded-2xl border-2 border-border text-foreground font-bold">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={goNext}
                  disabled={!canProceedEmergency}
                  className="flex-1 bg-primary text-primary-foreground font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {l("next", lang)} <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Check-in Frequency */}
          {step === "frequency" && (
            <motion.div key="freq" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
              <h2 className="text-2xl font-extrabold text-foreground text-center mb-2">
                {stepTitles.frequency[lang] || stepTitles.frequency.en}
              </h2>
              <p className="text-muted-foreground text-center mb-6 text-lg">
                {l("frequency_desc", lang)}
              </p>

              <div className="space-y-3 mb-8">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`w-full rounded-2xl border-3 p-5 text-left font-bold text-xl transition-all ${
                      frequency === opt.value ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card"
                    } text-card-foreground`}
                  >
                    {opt.labels[lang] || opt.labels.en}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={goBack} className="px-5 py-4 rounded-2xl border-2 border-border text-foreground font-bold">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 bg-success text-success-foreground font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2"
                >
                  {l("finish", lang)} <Check className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}

          {/* DONE */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center py-12"
            >
              <div className="w-28 h-28 rounded-full bg-success flex items-center justify-center mb-6">
                <Check className="w-16 h-16 text-success-foreground" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground mb-4">{l("done", lang)}</h2>
              
              {linkCode && (
                <div className="bg-card border-2 border-border rounded-2xl p-6 w-full text-center mb-8">
                  <p className="text-sm text-muted-foreground mb-2">Your Link Code</p>
                  <p className="text-4xl font-mono font-extrabold tracking-widest text-primary">{linkCode}</p>
                  <p className="text-xs text-muted-foreground mt-4">Share this code with your family or caregivers so they can link to your account.</p>
                </div>
              )}

              <button
                onClick={() => markSetupComplete()}
                className="w-full bg-primary text-primary-foreground font-extrabold text-xl py-5 rounded-2xl flex items-center justify-center gap-2"
              >
                {l("finish", lang)} <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SetupWizard;
