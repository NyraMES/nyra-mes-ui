import axios from "axios";

import { apiBaseUrl } from "../auth/cognitoConfig";

const FIELD_LABELS = {
  name: "Name",
  email: "Email",
  organisation: "Organisation",
  message: "Message"
};

/**
 * Turn FastAPI validation errors into a single user-facing string.
 * @param {unknown} detail
 * @returns {string | null}
 */
export function formatContactApiError(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const field = Array.isArray(item.loc)
        ? item.loc[item.loc.length - 1]
        : null;
      const label =
        typeof field === "string" ? FIELD_LABELS[field] || field : "Field";
      const msg = typeof item.msg === "string" ? item.msg : null;
      if (!msg) return null;
      return `${label}: ${msg}`;
    })
    .filter(Boolean);

  return messages.length ? messages.join(" ") : null;
}

/**
 * Submit landing-page contact form without opening the user's mail client.
 * @param {{ name: string, email: string, organisation?: string, message: string }} payload
 */
export async function submitContactEnquiry(payload) {
  const { data } = await axios.post(`${apiBaseUrl}/public/contact-enquiry`, payload, {
    headers: { "Content-Type": "application/json" }
  });
  return data;
}
