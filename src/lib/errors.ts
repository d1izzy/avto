export type ErrorCode =
  | "BOOKING_SLOT_UNAVAILABLE" | "BOOKING_NOT_FOUND" | "BOOKING_ALREADY_CANCELLED"
  | "BOOKING_RESCHEDULE_NOT_ALLOWED" | "RESOURCE_NOT_FOUND" | "SERVICE_NOT_AVAILABLE"
  | "TENANT_NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "RESOURCE_HAS_BOOKINGS" | "RESOURCE_REQUIRED" | "UNKNOWN";

const messages: Record<ErrorCode, string> = {
  BOOKING_SLOT_UNAVAILABLE: "Это время уже занято. Выберите другой интервал.",
  BOOKING_NOT_FOUND: "Запись не найдена или ссылка недействительна.",
  BOOKING_ALREADY_CANCELLED: "Запись уже отменена.",
  BOOKING_RESCHEDULE_NOT_ALLOWED: "Перенос этой записи недоступен.",
  RESOURCE_NOT_FOUND: "Подходящий бокс не найден.",
  RESOURCE_HAS_BOOKINGS: "У бокса есть предстоящие записи. Сначала перенесите их или отмените.",
  RESOURCE_REQUIRED: "Выберите хотя бы один бокс для услуги.",
  SERVICE_NOT_AVAILABLE: "Услуга сейчас недоступна.",
  TENANT_NOT_FOUND: "Сервис не найден.",
  UNAUTHORIZED: "Войдите в аккаунт владельца.",
  FORBIDDEN: "Недостаточно прав для этого действия.",
  VALIDATION_ERROR: "Проверьте заполненные поля.",
  UNKNOWN: "Не удалось выполнить операцию. Повторите попытку."
};

export class AppError extends Error {
  constructor(public code: ErrorCode, message?: string) { super(message ?? messages[code]); }
}

export function toAppError(error: unknown) {
  const raw = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : String(error);
  const code = (Object.keys(messages) as ErrorCode[]).find((key) => raw.includes(key));
  return new AppError(code ?? "UNKNOWN");
}
