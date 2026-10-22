import { Fragment, useEffect, useMemo, useState } from "react";

import {
  createAcUser,
  fetchAcAssignableUserRoles,
  fetchAcUsers,
  formatAcApiError,
  updateAcUser
} from "../../../services/activatedCarbonApi";
import { invalidateAcPersonLabels } from "../hooks/useAcPersonLabel";
import { useAuth } from "../../../auth/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import AcAlert from "../components/AcAlert";
import AcCreatedIdsDialog from "../components/AcCreatedIdsDialog";
import AcPermissionNotice from "../components/AcPermissionNotice";
import AcSaveBar from "../components/AcSaveBar";
import { userCanAccessAcUsers } from "../utils/acPrivileges";
import { SectionHeader, WfCard, WfCardBody, WfCardHeader } from "../../../workflow/ui";

function roleList(row) {
  if (Array.isArray(row?.role_labels) && row.role_labels.length) return row.role_labels;
  if (row?.role_label) return [row.role_label];
  return [];
}

function roleCodesOf(row) {
  if (Array.isArray(row?.role_codes) && row.role_codes.length) return row.role_codes;
  return row?.role_code ? [row.role_code] : [];
}

function RoleChecks({ roles, selected, onChange, disabled, compact = false }) {
  const toggle = (code) => {
    const next = selected.includes(code)
      ? selected.filter((item) => item !== code)
      : [...selected, code];
    onChange(next);
  };
  return (
    <div className={compact ? "grid gap-1 grid-cols-2 min-w-[16rem]" : "grid gap-2 sm:grid-cols-2"}>
      {roles.map((role) => (
        <label key={role.role_code} className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={selected.includes(role.role_code)}
            disabled={disabled}
            onChange={() => toggle(role.role_code)}
          />
          {role.label}
        </label>
      ))}
    </div>
  );
}

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
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(null);
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
        role_code: selectedRoles[0],
        role_codes: selectedRoles,
        password
      });
      setUsername("");
      setEmail("");
      setNickname("");
      setPassword("");
      setSelectedRoles([]);
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

  const startEdit = (row) => {
    setEditingId(row.user_id);
    setEditDraft({
      email: row.email || "",
      display_name: row.display_name || "",
      role_codes: roleCodesOf(row),
      is_active: row.is_active !== false
    });
    setError("");
    setSuccess("");
  };

  const saveEdit = async () => {
    if (!canManage || saving || !editDraft) return;
    if (!editDraft.role_codes.length) {
      setError("Select at least one role.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await updateAcUser(editingId, editDraft);
      invalidateAcPersonLabels();
      setSuccess(result.cognito_message || "User updated.");
      setEditingId("");
      setEditDraft(null);
      await load();
    } catch (err) {
      setError(formatAcApiError(err, "Could not update user"));
    } finally {
      setSaving(false);
    }
  };

  const createdItems = created
    ? [
        { label: "User ID", value: created.username },
        { label: "Nickname", value: created.display_name },
        { label: "Email", value: created.email },
        { label: "Roles", value: roleList(created).join(", ") },
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
          subtitle="Create plant users. A person can have more than one role. The screens for each selected role are shown together."
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
              <div className="text-sm">
                <span className="block mb-2 font-medium text-slate-700">Roles</span>
                <RoleChecks
                  roles={roles}
                  selected={selectedRoles}
                  disabled={saving || loading}
                  onChange={setSelectedRoles}
                />
                <span className="mt-1 block text-xs text-slate-600">
                  Tick every job this person does. Activation and Post Activation together open both screens.
                </span>
              </div>
              <AcSaveBar
                onSave={onCreate}
                saving={saving}
                saveLabel="Create user"
                disabled={!username.trim() || !email.trim() || !nickname.trim() || !selectedRoles.length}
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
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">User ID</th>
                  <th className="py-2 pr-3">Nickname</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Roles</th>
                  <th className="py-2 pr-3">Status</th>
                  {canManage ? <th className="py-2"> </th> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const editing = editingId === row.user_id && editDraft;
                  return (
                  <Fragment key={row.user_id}>
                  <tr className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-mono text-slate-800 whitespace-nowrap">{row.username || "—"}</td>
                    <td className="py-2 pr-3 text-slate-800">
                      {editing ? (
                        <input
                          type="text"
                          className="w-full min-w-[8rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                          value={editDraft.display_name}
                          maxLength={64}
                          disabled={saving}
                          aria-label="Nickname"
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, display_name: e.target.value }))}
                        />
                      ) : (
                        row.display_name || "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {editing ? (
                        <input
                          type="email"
                          className="w-full min-w-[14rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                          value={editDraft.email}
                          disabled={saving}
                          aria-label="Email"
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, email: e.target.value }))}
                        />
                      ) : (
                        row.email
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-800">
                      {editing ? (
                        <RoleChecks
                          compact
                          roles={roles}
                          selected={editDraft.role_codes}
                          disabled={saving}
                          onChange={(role_codes) => setEditDraft((prev) => ({ ...prev, role_codes }))}
                        />
                      ) : (
                        roleList(row).join(", ") || "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {editing ? (
                        <label className="flex items-center gap-2 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={editDraft.is_active}
                            disabled={saving}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
                          />
                          Active
                        </label>
                      ) : (
                        row.is_active ? "Active" : "Inactive"
                      )}
                    </td>
                    {canManage ? (
                      <td className="py-2 whitespace-nowrap">
                        {editing ? null : (
                          <button
                            type="button"
                            className="wf-btn wf-btn-primary"
                            disabled={saving}
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                  {editing ? (
                    <tr key={`${row.user_id}-actions`} className="border-b border-slate-100">
                      <td colSpan={canManage ? 6 : 5} className="pb-3 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="ac-user-row-btn ac-user-row-btn-save"
                            disabled={saving || !editDraft.display_name.trim() || !editDraft.email.trim() || !editDraft.role_codes.length}
                            onClick={saveEdit}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="ac-user-row-btn ac-user-row-btn-cancel"
                            disabled={saving}
                            onClick={() => {
                              setEditingId("");
                              setEditDraft(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
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
