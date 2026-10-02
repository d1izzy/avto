# Booking

`get_availability` учитывает timezone, график, service duration, buffers, совместимые ресурсы, исключения, occupancies, minimum notice и horizon.

`create_public_booking` атомарно разрешает tenant/service/resource, берёт цену и длительность из БД, обновляет/создаёт customer, создаёт vehicle, booking, occupancy и notification job. Exclusion violation преобразуется в `BOOKING_SLOT_UNAVAILABLE`. `(tenant_id, idempotency_key)` гарантирует ровно одну запись.

Отмена сохраняет booking и деактивирует occupancy. Перенос изменяет occupancy до booking внутри одной транзакции; exclusion violation откатывает оба изменения. Клиент управляет записью по secret link, owner — через Auth и membership.
