import { z } from "zod";

export const bookingSchema = z.object({
  // PostgreSQL UUIDs (including deterministic seed IDs) need not have RFC version bits.
  serviceId: z.guid("Выберите услугу заново."),
  resourceId: z.guid("Выберите свободное время заново."),
  startsAt: z.string().datetime({ offset: true, message: "Выберите дату и время заново." }),
  customerName: z.string().trim().min(2, "Введите имя").max(100),
  customerPhone: z.string().trim().min(7, "Введите корректный телефон").max(30),
  customerEmail: z.string().trim().email("Введите корректный email").optional().or(z.literal("")),
  vehicleBrand: z.string().trim().min(1, "Укажите марку").max(80),
  vehicleModel: z.string().trim().min(1, "Укажите модель").max(80),
  vehicleYear: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  licensePlate: z.string().trim().max(20).optional()
});
export type BookingForm = z.infer<typeof bookingSchema>;
