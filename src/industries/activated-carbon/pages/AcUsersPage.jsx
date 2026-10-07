import { useEffect, useMemo, useState } from "react";

import {
  createAcUser,
  fetchAcAssignableUserRoles,
  fetchAcUsers,
  formatAcApiError
} from "../../../services/activatedCarbonApi";
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
  const [displayName, setDisplayName] = useState("");
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
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createAcUser({
        username,
        email,
        display_name: displayName,
        role_code: roleCode
      });
      setUsername("");
      setEmail("");
      setDisplayName("");
      setCreated(result);
      setSuccess(result.cognito_message || "User created.");
      await load();
    } catch (err) {
      setError(formatAcApiError(err, "Could not create user"));
    } finally {
      setSaving(false);
    }
  };

  const createdItems = created
    ? [
        { label: "User ID", value: created.username },
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
          title="Administrator access required"
          message="Only an Administrator can create users for this plant."
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
                <span className="block mb-1 font-medium text-slate-700">Display name</span>
                <input
                  type="text"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Optional"
                  disabled={saving}
                  autoComplete="off"
                />
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
                disabled={!username.trim() || !email.trim() || !roleCode}
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
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.user_id} className="border-b border-slate-100">
                    <td className="py-2 font-mono text-slate-800">{row.username || "—"}</td>
                    <td className="py-2 text-slate-900">{row.display_name || "—"}</td>
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
