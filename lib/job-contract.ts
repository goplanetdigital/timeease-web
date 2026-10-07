export type DeliveryType = "pull_request" | "patch" | "files";

export type TimeEaseJobPayload = {
  job_id: string;
  repository: string;
  task: string;
  acceptance_criteria: string[];
  allowed_scope: string[];
  forbidden_scope: string[];
  delivery_type: DeliveryType;
  customer_deadline: string | null;
  notes?: string;
};

export type JobValidationResult =
  | {
      ok: true;
      normalized: TimeEaseJobPayload;
      status: "READY_FOR_CODEX";
    }
  | {
      ok: false;
      status: "NEEDS_CLARIFICATION";
      errors: string[];
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

export function validateJobPayload(input: unknown): JobValidationResult {
  const data = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (!isNonEmptyString(data.job_id)) errors.push("job_id is required");
  if (!isNonEmptyString(data.repository)) errors.push("repository is required");
  if (!isNonEmptyString(data.task)) errors.push("task is required");
  if (!isStringArray(data.acceptance_criteria) || data.acceptance_criteria.length === 0) {
    errors.push("acceptance_criteria must contain at least one item");
  }
  if (!isStringArray(data.allowed_scope) || data.allowed_scope.length === 0) {
    errors.push("allowed_scope must contain at least one item");
  }
  if (!isStringArray(data.forbidden_scope)) {
    errors.push("forbidden_scope must be an array of strings");
  }

  const deliveryType = data.delivery_type;
  if (!["pull_request", "patch", "files"].includes(String(deliveryType))) {
    errors.push("delivery_type must be pull_request, patch, or files");
  }

  if (data.customer_deadline !== null && data.customer_deadline !== undefined && !isNonEmptyString(data.customer_deadline)) {
    errors.push("customer_deadline must be a string or null");
  }

  if (errors.length > 0) {
    return { ok: false, status: "NEEDS_CLARIFICATION", errors };
  }

  return {
    ok: true,
    status: "READY_FOR_CODEX",
    normalized: {
      job_id: String(data.job_id).trim(),
      repository: String(data.repository).trim(),
      task: String(data.task).trim(),
      acceptance_criteria: (data.acceptance_criteria as string[]).map((x) => x.trim()),
      allowed_scope: (data.allowed_scope as string[]).map((x) => x.trim()),
      forbidden_scope: (data.forbidden_scope as string[]).map((x) => x.trim()),
      delivery_type: deliveryType as DeliveryType,
      customer_deadline:
        data.customer_deadline === null || data.customer_deadline === undefined
          ? null
          : String(data.customer_deadline).trim(),
      notes: isNonEmptyString(data.notes) ? data.notes.trim() : "",
    },
  };
}
