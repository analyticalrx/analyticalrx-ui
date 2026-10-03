export const userRoles = ["technician", "book_keeper", "store_manager"] as const;
export type ManagedRole = typeof userRoles[number];
export interface UserDraft {
  userName: string;
  email: string;
  userId: string;
  role: ManagedRole;
  password: string;
}
export const roleNames: Record<ManagedRole, string> = {
  technician: "Technician", book_keeper: "Bookkeeper", store_manager: "Store manager",
};
export const csvHeaders = ["user_name", "email", "user_id", "password", "role"];

export function validateUser(input: Record<string, string>, existing: UserDraft[]): UserDraft {
  const userName = (input.userName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const userId = (input.userId ?? "").trim();
  const role = (input.role ?? "").trim().toLowerCase();
  if (!userName) throw new Error("User name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!userId) throw new Error("User ID is required.");
  if (!userRoles.includes(role as ManagedRole)) throw new Error("Role must be technician, book_keeper, or store_manager.");
  if (existing.some((user) => user.email.toLowerCase() === email)) throw new Error(`Email already exists: ${email}.`);
  if (existing.some((user) => user.userId.toLowerCase() === userId.toLowerCase())) throw new Error(`User ID already exists: ${userId}.`);
  return { userName, email, userId, role: role as ManagedRole, password: input.password ?? "" };
}

// Handles quoted commas, escaped quotes, BOM, CRLF, and newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  function cell() { row.push(field); field = ""; closed = false; }
  function record() { cell(); if (row.some((value) => value.trim())) rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ",") cell();
    else if (char === "\n" || char === "\r") { record(); if (char === "\r" && text[i + 1] === "\n") i++; }
    else if (char === '"') {
      if (field || closed) throw new Error("Invalid CSV quoting. Use the sample format.");
      quoted = true;
    } else {
      if (closed) throw new Error("Unexpected content after a quoted CSV value.");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  if (field || row.length || closed) record();
  return rows;
}

export function importUsers(text: string, existing: UserDraft[]): UserDraft[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("Include a header and at least one user.");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  if (headers.length !== csvHeaders.length || new Set(headers).size !== headers.length || csvHeaders.some((header) => !headers.includes(header))) {
    throw new Error(`Required columns: ${csvHeaders.join(", ")}. Password values may be empty.`);
  }
  if (rows.length > 501) throw new Error("Import up to 500 users at a time.");
  const users: UserDraft[] = [];
  for (let i = 1; i < rows.length; i++) {
    try {
      if (rows[i].length !== headers.length) throw new Error("Column count does not match the header.");
      const get = (key: string) => rows[i][headers.indexOf(key)];
      users.push(validateUser({ userName: get("user_name"), email: get("email"), userId: get("user_id"), password: get("password"), role: get("role") }, [...existing, ...users]));
    } catch (error) { throw new Error(`CSV record ${i + 1}: ${error instanceof Error ? error.message : "Invalid user."} No users were imported.`); }
  }
  return users;
}
