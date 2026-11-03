import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import editIcon from "@/assets/Edit_2.svg";
import WorkSummary from "./WorkSummary";
import LogoutModal from "@/components/common/LogoutModal";
import eyeIcon from "@/assets/eye_icon.svg";
import { useNavigate, useLocation } from "react-router-dom";
import chefImg from "@/assets/chef.svg";
import { useWalkthroughStore } from "@/store/walkthroughStore";
import {
  useChangePasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} from "@/redux/api/settingsApi";
import toast from "react-hot-toast";
import { useLogout } from "@/hooks/useLogout";

interface User {
  _id: string;
  Name: string;
  Responsibility_id: { Responsibility_id: number; Responsibility_name: string };
  Role_id: { Role_id: number; role_name: string };
  Employee_id: string;
  email: string;
  phone: string;
  user_image: string;
  OnboardingDate: string;
  yearsWithus: number;
  shift_timings?: string;
  total_leave_days?: number;
  leave_left_days?: number;
  first_name?: string;
  last_name?: string;
  recovery_email?: string | null;
}

interface ProfileDesktopProps {
  forceSecurityTab?: boolean;
  forceWorkTab?: boolean;
  user?: User;
}

const fieldGradient =
  "linear-gradient(180deg, rgba(106, 27, 154, 0.1) 0%, rgba(211, 47, 47, 0.1) 100%)";
const tabGradient = "linear-gradient(180deg, #6A1B9A 0%, #D32F2F 100%)";

const PASSWORD_MIN_LENGTH = 8;

/* ------------------------------------------------------------------ */
/* Inline EditProfileModal                                            */
/* ------------------------------------------------------------------ */

interface EditProfilePayload {
  first_name: string;
  last_name: string;
  phone: string;
  recovery_email?: string;
  profile_image?: string;
}

interface EditProfileModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  initial: EditProfilePayload;
  onClose: () => void;
  onSave: (payload: EditProfilePayload) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  isSaving,
  initial,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<EditProfilePayload>(initial);

  useEffect(() => {
    if (isOpen) setForm(initial);
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const update = <K extends keyof EditProfilePayload>(
    key: K,
    value: EditProfilePayload[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const isValid =
    form.first_name.trim() !== "" &&
    form.last_name.trim() !== "" &&
    form.phone.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">{t("Edit Profile")}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-gray-700 mb-1 block">
              {t("First Name")}
            </label>
            <input
              className="w-full rounded-lg px-4 py-2 border border-[#E0E0E0]"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 mb-1 block">
              {t("Last Name")}
            </label>
            <input
              className="w-full rounded-lg px-4 py-2 border border-[#E0E0E0]"
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 mb-1 block">
              {t("Phone")}
            </label>
            <input
              className="w-full rounded-lg px-4 py-2 border border-[#E0E0E0]"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 mb-1 block">
              {t("Recovery Email")}
            </label>
            <input
              type="email"
              className="w-full rounded-lg px-4 py-2 border border-[#E0E0E0]"
              value={form.recovery_email ?? ""}
              onChange={(e) => update("recovery_email", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="font-bold text-gray-700 mb-1 block">
              {t("Profile Image URL")}
            </label>
            <input
              className="w-full rounded-lg px-4 py-2 border border-[#E0E0E0]"
              value={form.profile_image ?? ""}
              onChange={(e) => update("profile_image", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 rounded-lg border border-gray-300"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("Cancel")}
          </button>
          <button
            className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
            style={{ background: tabGradient }}
            onClick={() => onSave(form)}
            disabled={isSaving || !isValid}
          >
            {isSaving ? t("Saving...") : t("Save")}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* ProfileDesktop                                                     */
/* ------------------------------------------------------------------ */

const ProfileDesktop: React.FC<ProfileDesktopProps> = ({
  forceSecurityTab,
  forceWorkTab,
  user: userProp,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isActive, activeTraining, steps, currentStep, complete } =
    useWalkthroughStore();

  const { handleLogout, isLoggingOut } = useLogout();

  /* ---------------- Profile data ---------------- */
  const {
    data: profileResponse,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useGetProfileQuery();

  const [updateProfile, { isLoading: isUpdatingProfile }] =
    useUpdateProfileMutation();

  const mappedUser: User | undefined = useMemo(() => {
    const api = profileResponse?.data;
    if (api) {
      const onboardingYear = api.onboarding_date
        ? new Date(api.onboarding_date).getFullYear()
        : undefined;
      const yearsWithUs = onboardingYear
        ? Math.max(0, new Date().getFullYear() - onboardingYear)
        : 0;

      return {
        _id: api._id,
        Name:
          api.full_name ||
          `${api.first_name ?? ""} ${api.last_name ?? ""}`.trim(),
        first_name: api.first_name,
        last_name: api.last_name,
        Responsibility_id: {
          Responsibility_id: 0,
          Responsibility_name: api.responsibility || "N/A",
        },
        Role_id: { Role_id: 0, role_name: api.role || "N/A" },
        Employee_id: api.employee_id_code || api.employee_login_code,
        email: api.email,
        phone: api.phone,
        user_image: api.profile_image,
        OnboardingDate: api.onboarding_date
          ? new Date(api.onboarding_date).toLocaleDateString()
          : "N/A",
        yearsWithus: yearsWithUs,
        shift_timings: api.shift_timings,
        total_leave_days: api.total_leave_days,
        leave_left_days: api.leave_left_days,
        recovery_email: api.recovery_email,
      };
    }
    return userProp;
  }, [profileResponse, userProp]);

  /* ---------------- Tabs & modals ---------------- */
  const [selectedTab, setSelectedTab] = useState<
    null | "work" | "personal" | "security" | "sign-out"
  >(null);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  /* ---------------- Password state ---------------- */
  const [changePassword, { isLoading: isChangingPassword }] =
    useChangePasswordMutation();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showReNewPassword, setShowReNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [reNewPassword, setReNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return t("Password is required.");
    if (pwd.length < PASSWORD_MIN_LENGTH)
      return `${t("Password must be at least")} ${PASSWORD_MIN_LENGTH} ${t(
        "characters."
      )}`;
    if (!/[A-Z]/.test(pwd))
      return t("Password must include at least one uppercase letter.");
    if (!/[a-z]/.test(pwd))
      return t("Password must include at least one lowercase letter.");
    if (!/[0-9]/.test(pwd))
      return t("Password must include at least one number.");
    if (!/[^A-Za-z0-9]/.test(pwd))
      return t("Password must include at least one special character.");
    return null;
  };

  const extractErrorMessage = (error: any): string => {
    if (!error) return t("Failed to change password.");
    if (error.status === 401)
      return t("Your session expired. Please sign in again.");
    if (typeof error.data === "string") return error.data;
    if (typeof error.data?.message === "string") return error.data.message;
    if (typeof error.data?.error === "string") return error.data.error;
    if (typeof error.error === "string") return error.error;
    return t("Failed to change password.");
  };

  useEffect(() => {
    if (location.state && location.state.tab) setSelectedTab(location.state.tab);
  }, [location.state]);

  useEffect(() => {
    if (activeTraining !== "profile") {
      if (forceSecurityTab && selectedTab !== "security")
        setSelectedTab("security");
      else if (forceWorkTab && selectedTab !== "work") setSelectedTab("work");
    }
  }, [forceSecurityTab, forceWorkTab, selectedTab, activeTraining]);

  const handleSignOutClick = () => {
    setLogoutModalOpen(true);
    setSelectedTab("sign-out");
  };

  const handleCloseLogoutModal = () => {
    setLogoutModalOpen(false);
    setSelectedTab(null);
  };

  const handleConfirmLogout = (savePassword: boolean) => {
    setLogoutModalOpen(false);
    setSelectedTab(null);
    handleLogout(savePassword);
  };

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setReNewPassword("");
    setPasswordError(null);
  };

  const handleSavePassword = async () => {
    setPasswordError(null);

    if (!currentPassword) {
      toast.error(t("Please enter your current password."));
      return;
    }
    if (!newPassword || !reNewPassword) {
      toast.error(t("Please fill in the new password fields."));
      return;
    }
    if (newPassword !== reNewPassword) {
      toast.error(t("New passwords do not match!"));
      return;
    }
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setPasswordError(pwdError);
      toast.error(pwdError);
      return;
    }
    if (newPassword === currentPassword) {
      toast.error(
        t("New password must be different from the current password.")
      );
      return;
    }

    try {
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: reNewPassword,
      }).unwrap();
      toast.success(result?.message || t("Password changed successfully!"));
      resetPasswordFields();
    } catch (error: any) {
      const msg = extractErrorMessage(error);
      toast.error(msg);
      setCurrentPassword("");
      setPasswordError(msg);
    }
  };

  const canSubmitPassword =
    !!currentPassword && !!newPassword && !!reNewPassword;

  /* ---------------- Save profile ---------------- */
  const handleSaveProfile = async (body: EditProfilePayload) => {
    try {
      const result = await updateProfile(body).unwrap();
      toast.success(result?.message || t("Profile updated"));
      setEditModalOpen(false);
    } catch (error: any) {
      toast.error(error?.data?.message || t("Failed to update profile"));
    }
  };

  /* ---------------- Early states ---------------- */
  if (isProfileLoading) {
    return (
      <div className="pt-10 px-10 flex items-center justify-center min-h-[60vh]">
        <span className="text-gray-500">{t("Loading profile...")}</span>
      </div>
    );
  }

  if (isProfileError || !mappedUser) {
    return (
      <div className="pt-10 px-10 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span className="text-red-500">{t("Failed to load profile.")}</span>
        <button
          onClick={() => refetchProfile()}
          className="px-4 py-2 rounded-lg text-white"
          style={{ background: tabGradient }}
        >
          {t("Retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={`pt-10 px-10 profile-highlight relative`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-black">
          {t("My Profile")}
          {selectedTab === "personal" && (
            <span className="text-lg font-semibold ml-2">
              &gt; {t("Personal")}
            </span>
          )}
          {selectedTab === "work" && (
            <span className="text-lg font-semibold ml-2">
              &gt; {t("Work Summary")}
            </span>
          )}
          {selectedTab === "security" && (
            <span className="text-lg font-semibold ml-2">
              &gt; {t("Security")}
            </span>
          )}
        </h1>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 rounded-lg font-medium text-white profile-work-tab"
            style={{
              background: tabGradient,
              opacity: selectedTab === "work" ? 1 : 0.4,
            }}
            onClick={() => setSelectedTab("work")}
          >
            {t("Work Summary")}
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium text-white profile-personal-tab"
            style={{
              background: tabGradient,
              opacity: selectedTab === "personal" ? 1 : 0.4,
            }}
            onClick={() => setSelectedTab("personal")}
          >
            {t("Personal")}
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium text-white profile-sign-out-tab"
            style={{
              background: tabGradient,
              opacity: selectedTab === "sign-out" ? 1 : 0.4,
            }}
            onClick={handleSignOutClick}
          >
            {t("Sign out")}
          </button>
        </div>
      </div>

      {selectedTab === null && (
        <>
          <div className="font-semibold text-lg mb-4">
            {t("Employee Details")}
          </div>
          <div className="flex gap-8 items-start">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <img
                  src={mappedUser.user_image || chefImg}
                  alt="Profile"
                  className="w-38 h-44 rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="absolute top-0 -right-1 bg-white rounded-full shadow"
                  aria-label={t("Edit profile")}
                >
                  <img src={editIcon} alt={t("Edit")} className="h-7 w-7" />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-6 w-full">
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Role")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.Role_id?.role_name || t("N/A")}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Responsibility")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.Responsibility_id?.Responsibility_name ||
                      t("N/A")}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Name")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.Name}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Employee ID")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.Employee_id}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Email")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.email}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-700 mb-1">
                    {t("Phone")}
                  </div>
                  <div
                    className="rounded-lg px-4 py-2"
                    style={{ background: fieldGradient }}
                  >
                    {mappedUser.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedTab === "work" && (
        <div className="profile-work-tab">
          <WorkSummary layout="desktop" />
        </div>
      )}

      {selectedTab === "personal" && (
        <>
          <div className="font-semibold text-lg mb-4 text-[#888]">
            {t("Employee Details")}
          </div>
          <div className="grid grid-cols-3 gap-6 w-full mb-8">
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Employee ID")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.Employee_id || t("N/A")}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">{t("Role")}</div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.Role_id?.role_name || t("N/A")}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Responsibility")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.Responsibility_id?.Responsibility_name || t("N/A")}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">{t("Name")}</div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.Name}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">{t("Email")}</div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.email}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">{t("Phone")}</div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.phone}
              </div>
            </div>
          </div>
          <div className="font-semibold text-lg mb-4 text-[#888]">
            {t("Work Details")}
          </div>
          <div className="grid grid-cols-3 gap-6 w-full">
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Onboarding Date")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.OnboardingDate}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("year's with us")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.yearsWithus} {t("Year's")}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Shift Timings")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.shift_timings || t("N/A")}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Total Leave")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.total_leave_days
                  ? `${mappedUser.total_leave_days} ${t("Day's")}`
                  : `0 ${t("Day's")}`}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-700 mb-1">
                {t("Leave Left")}
              </div>
              <div
                className="rounded-lg px-4 py-2"
                style={{ background: fieldGradient }}
              >
                {mappedUser.leave_left_days
                  ? `${mappedUser.leave_left_days} ${t("Day's")}`
                  : `0 ${t("Day's")}`}
              </div>
            </div>
          </div>
        </>
      )}

      {selectedTab === "security" && (
        <div className="mt-8 profile-security-tab">
          <div className="font-semibold text-xl mb-6">
            {t("Privacy and Password")}
          </div>
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <div className="font-bold text-gray-700 mb-1">{t("Email")}</div>
              <div className="rounded-lg px-4 py-2 bg-gradient-to-r from-[#F8EAEE] to-[#F9F6FB] text-black/80 font-medium">
                {mappedUser.email}
              </div>
            </div>
            {mappedUser.recovery_email && (
              <div>
                <div className="font-bold text-gray-700 mb-1">
                  {t("Recovery Email")}
                </div>
                <div className="rounded-lg px-4 py-2 bg-gradient-to-r from-[#F8EAEE] to-[#F9F6FB] text-black/80 font-medium">
                  {mappedUser.recovery_email}
                </div>
              </div>
            )}
          </div>

          {/* Uncomment to re-enable change-password UI */}
          {/*
          <div className="font-semibold text-xl mb-4 mt-8">{t("Change Password")}</div>
          <div className="grid grid-cols-2 gap-8 items-end">
            ... password inputs bound to currentPassword/newPassword/reNewPassword ...
          </div>
          {passwordError && (
            <div className="mt-4 text-sm text-red-600 font-medium">{passwordError}</div>
          )}
          <button
            onClick={handleSavePassword}
            className="w-full mt-8 py-3 rounded-xl text-white font-semibold text-lg bg-gradient-to-r from-[#6A1B9A] to-[#D32F2F] disabled:opacity-50 transition-all"
            disabled={isChangingPassword || !canSubmitPassword}
          >
            {isChangingPassword ? t("Saving...") : t("Save Password")}
          </button>
          */}
        </div>
      )}

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => !isLoggingOut && handleCloseLogoutModal()}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />

      <EditProfileModal
        isOpen={isEditModalOpen}
        isSaving={isUpdatingProfile}
        initial={{
          first_name: mappedUser.first_name ?? "",
          last_name: mappedUser.last_name ?? "",
          phone: mappedUser.phone ?? "",
          recovery_email: mappedUser.recovery_email ?? "",
          profile_image: mappedUser.user_image ?? "",
        }}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
};

export default ProfileDesktop;