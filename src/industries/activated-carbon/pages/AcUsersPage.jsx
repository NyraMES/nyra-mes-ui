import { useEffect, useMemo, useState } from "react";

import {
  createAcUser,
  fetchAcAssignableUserRoles,
  fetchAcUsers,
  formatAcApiError,
  updateAcUserNickname
} from "../../../services/activatedCarbonApi";
import { invalidateAcPersonLabels } from "../hooks/useAcPersonLabel";
import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import AcAlert from "../components/AcAlert";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcFormSelect from "../components/AcFormSelect";
import AcPermissionNotice from "../components/AcPermissionNotice";
import AcSaveBar from "../components/AcSaveBar";
import { userCanAccessAcUsers } from "../utils/acPrivileges";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function previewUserId(raw, suffix) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  if (!value.includes("@")) return `${value}${suffix}`;
  return value;
}

function AcUsersPage({ embedded = false }) {
  const { user } = useAuth();
  const { context } = useAppContext();
  const canManage = userCanAccessAcUsers(user?.roles || [], user);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loginSuffix, setLoginSuffix] = useState("@grcarbons");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nicknameDrafts, setNicknameDrafts] = useState({});
  const [roleCode, setRoleCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [created, setCreated] = useState(null);

  const preview = useMemo(
    () => previewUserId(username, loginSuffix),
    [username, loginSuffix]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [list, rolePayload] = await Promise.all([
        fetchAcUsers(),
        fetchAcAssignableUserRoles()
      ]);
      setUsers(list);
      setNicknameDrafts(
        Object.fromEntries((list || []).map((row) => [row.user_id, row.display_name || ""]))
      );
      setRoles(rolePayload.items || []);
      if (rolePayload.login_suffix) {
        setLoginSuffix(rolePayload.login_suffix);
      }
      if (!roleCode && rolePayload.items?.length) {
        setRoleCode(rolePayload.items[0].role_code);
      }
    } catch (err) {
      setError(formatAcApiError(err, "Could not load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.tenant_code]);

  const onCreate = async () => {
    if (!canManage || saving) return;
    const loginName = previewUserId(username, loginSuffix);
    const domain = loginName.includes("@") ? loginName.split("@")[1] : "";
    if (domain !== String(loginSuffix).replace(/^@/, "")) {
      setError(`User ID must end with ${loginSuffix}.`);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters and include upper and lower case, a number, and a symbol.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcUser({
        username,
        email,
        display_name: nickname,
        role_code: roleCode,
        password
      });
      setUsername("");
      setEmail("");
      setNickname("");
      setPassword("");
      setCreated(result);
      invalidateAcPersonLabels();
      setSuccess(result.cognito_message || "User created.");
      await load();
    } catch (err) {
      setError(formatAcApiError(err, "Could not create user"));
    } finally {
      setSaving(false);
    }
  };

  const saveNickname = async (row) => {
    if (!canManage || saving) return;
    const next = String(nicknameDrafts[row.user_id] || "").trim();
    if (!next || next === String(row.display_name || "").trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateAcUserNickname(row.user_id, next);
      invalidateAcPersonLabels();
      setSuccess(`Nickname for ${row.username || row.email} saved.`);
      await load();
    } catch (err) {
      setError(formatAcApiError(err, "Could not save nickname"));
    } finally {
      setSaving(false);
    }
  };

  const createdItems = created
    ? [
        { label: "User ID", value: created.username },
        { label: "Nickname", value: created.display_name },
        { label: "Email", value: created.email },
        { label: "Role", value: created.role_label || created.role_code },
        created.temporary_password
          ? { label: "Password", value: created.temporary_password }
          : null
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      {embedded ? null : (
        <SectionHeader
          title="Users"
          subtitle="Create plant users. User ID is the login; email is their mailbox. Role maps to the MES Cognito group."
        />
      )}

      {!canManage ? (
        <AcPermissionNotice
          title="Admin access required"
          message="Open Admin to create plant users."
        />
      ) : null}

      <AcAlert variant="error">{error}</AcAlert>
      <AcAlert variant="success">{success}</AcAlert>

      {canManage ? (
        <WfCard>
          <WfCardHeader title="Create user" />
          <WfCardBody>
            <div className="grid gap-4 max-w-xl">
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">User ID</span>
                <input
                  type="text"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={`ramesh or ramesh${loginSuffix}`}
                  disabled={saving}
                  autoComplete="off"
                />
                <span className="mt-1 block text-xs text-slate-600">
                  Must end with {loginSuffix}. Sign-in name:{" "}
                  <span className="font-mono text-slate-800">{preview || `name${loginSuffix}`}</span>
                </span>
              </label>
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@grcarbons.com"
                  disabled={saving}
                  autoComplete="off"
                />
              </label>
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">Nickname</span>
                <input
                  type="text"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ramesh"
                  maxLength={64}
                  disabled={saving}
                  autoComplete="off"
                />
                <span className="mt-1 block text-xs text-slate-600">
                  Shown on screens. Must be unique in this plant. Sign-in still uses the user id.
                </span>
              </label>
              <label className="text-sm block">
                <span className="block mb-1 font-medium text-slate-700">Temporary password</span>
                <div className="flex gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className="mt-1 block text-xs text-slate-600">
                  Emailed to the user. They sign in with it once and then choose their own password.
                </span>
              </label>
              <AcFormSelect
                label="Role"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                loading={loading}
                emptyMessage="No roles available for your account"
                disabled={saving}
              >
                {roles.map((role) => (
                  <option key={role.role_code} value={role.role_code}>
                    {role.label}
                  </option>
                ))}
              </AcFormSelect>
              <AcSaveBar
                onSave={onCreate}
                saving={saving}
                saveLabel="Create user"
                disabled={!username.trim() || !email.trim() || !nickname.trim() || !roleCode}
              />
            </div>
          </WfCardBody>
        </WfCard>
      ) : null}

      <WfCard>
        <WfCardHeader title="Plant users" />
        <WfCardBody>
          {loading ? (
            <p className="text-sm text-slate-600">Loading users…</p>
          ) : users.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">User ID</th>
                  <th className="py-2">Nickname</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.user_id} className="border-b border-slate-100">
                    <td className="py-2 font-mono text-slate-800">{row.username || "—"}</td>
                    <td className="py-2">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-40 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
                            value={nicknameDrafts[row.user_id] ?? ""}
                            maxLength={64}
                            disabled={saving}
                            onChange={(e) =>
                              setNicknameDrafts((prev) => ({
                                ...prev,
                                [row.user_id]: e.target.value
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-blue-700 underline disabled:text-slate-400"
                            disabled={
                              saving ||
                              String(nicknameDrafts[row.user_id] || "").trim() ===
                                String(row.display_name || "").trim()
                            }
                            onClick={() => saveNickname(row)}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        row.display_name || "—"
                      )}
                    </td>
                    <td className="py-2 text-slate-700">{row.email}</td>
                    <td className="py-2 text-slate-800">{row.role_label || row.role_code}</td>
                    <td className="py-2">{row.is_active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-600">No users have been created for this plant yet.</p>
          )}
        </WfCardBody>
      </WfCard>

      <AcCreatedIdsDialog
        open={Boolean(created)}
        title="User created"
        subtitle={created?.cognito_message}
        items={createdItems}
        continueLabel="Done"
        onContinue={() => setCreated(null)}
        onClose={() => setCreated(null)}
      />
    </div>
  );
}

export default AcUsersPage;
