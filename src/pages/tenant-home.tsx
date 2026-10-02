import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Grid, Heading, HStack, Text, VStack } from "@astryxdesign/core";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Phone, Smartphone } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { money, durationLabel } from "@/lib/utils";
import { BookingFlow } from "./booking-flow";

export function TenantHome({ booking = false }: { booking?: boolean }) {
  const { tenant, services, hours, assets, settings } = useTenant();
  const catalog = useLocation().pathname.replace(/\/+$/, "").endsWith("/services"); const navigate = useNavigate();
  const base = `/s/${tenant.slug}`;
  const hero = tenant.hero_url || assets.find((asset) => asset.type === "hero")?.public_url;
  const gallery = assets.filter((asset) => asset.type === "gallery");
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tenant.timezone, weekday: "short" }).format(new Date());
  const today = hours.find((h) => h.weekday === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) && h.active);
  const startingPrice = services.length ? Math.min(...services.map((s) => s.price)) : null;
  return <VStack gap={6}>
    {!catalog && <>
      <VStack className="relative overflow-hidden rounded-2xl bg-muted" height={320} justify="end" padding={5}>
        {hero && <img src={hero} alt="Автомобиль — атмосфера студии" fetchPriority="high" className="absolute inset-0 size-full object-cover" />}
        <VStack className="absolute inset-0 bg-gradient-to-t from-body via-body/20 to-transparent" aria-hidden />
        <VStack className="relative"><Button variant="primary" label={settings.booking_enabled ? "Записаться" : "Онлайн-запись приостановлена"} size="lg" width="100%" isDisabled={!settings.booking_enabled} onClick={() => navigate(`${base}/book`)} icon={<ArrowUpRight />} /></VStack>
      </VStack>
      <VStack gap={3}><Heading level={1}>{tenant.name}</Heading><Text color="secondary" className="max-w-2xl">{tenant.description}</Text></VStack>
      <Grid columns={3} gap={3}>
        <Metric value={String(services.length)} label="услуги" />
        <Metric value={today ? `${today.start_time.slice(0, 5)}–${today.end_time.slice(0, 5)}` : "Закрыто"} label="сегодня, время студии" />
        <Metric value={startingPrice === null ? "—" : money(startingPrice, tenant.currency)} label="стоимость от" />
      </Grid>
    </>}
    <Grid columns={1} gap={6} className="lg:grid-cols-3">
      <VStack gap={6} className="min-w-0 lg:col-span-2">
        <VStack gap={4} as="section">
          <HStack align="center" justify="between"><Heading level={catalog ? 1 : 2}>Услуги студии</Heading><Text color="secondary" size="sm">{services.length} услуги</Text></HStack>
          <VStack className="overflow-hidden rounded-xl border border-border" gap={0}>{services.map((service) => <Link key={service.id} to={`${base}/book?service=${service.id}`} className="border-b border-border bg-surface last:border-0 hover:bg-muted focus-visible:bg-muted">
            <HStack gap={4} padding={5} align="center" justify="between"><VStack gap={2} className="min-w-0"><Text weight="semibold">{service.name}</Text><Text size="sm" color="secondary">{service.description}</Text><HStack gap={2} align="center"><Clock3 aria-hidden className="size-3 text-secondary" /><Text size="sm" color="secondary">{durationLabel(service.duration_minutes)}</Text></HStack></VStack><VStack gap={3} align="end" className="shrink-0"><Text weight="semibold">{money(service.price, service.currency)}</Text><ArrowUpRight aria-hidden className="size-5 text-accent" /></VStack></HStack>
          </Link>)}</VStack>
          {!services.length && <Text color="secondary">Услуги скоро появятся.</Text>}
        </VStack>
        {!catalog && <VStack gap={4} as="section"><Heading level={2}>{gallery.length ? "Работы студии" : "Атмосфера студии"}</Heading><Grid columns={gallery.length ? { minWidth: 220 } : 1} gap={3}>{(gallery.length ? gallery : hero ? [{ public_url: hero, alt_text: "Детали автомобиля · иллюстрация", sort_order: 0 }] : []).map((asset) => <VStack key={asset.public_url} gap={2}><img src={asset.public_url} alt={asset.alt_text ?? "Работа студии"} loading="lazy" className="aspect-video w-full rounded-xl object-cover" />{!gallery.length && <Text size="sm" color="secondary">Иллюстрация. Фотографии работ появятся после добавления студией.</Text>}</VStack>)}</Grid></VStack>}
      </VStack>
      <VStack gap={4} as="aside">
        <Card padding={6}><VStack gap={4}><CalendarDays aria-hidden className="size-7 text-accent" /><Heading level={2}>Свежий вид для вашего авто</Heading><Text color="secondary">Выберите услугу и удобное время. Мы покажем свободные места и итоговую стоимость.</Text><Button variant="primary" label="Выбрать время" isDisabled={!settings.booking_enabled} onClick={() => navigate(`${base}/book`)} size="lg" /></VStack></Card>
        <Card padding={5}><VStack gap={5}><Heading level={3}>Контакты</Heading><HStack gap={3} align="start"><MapPin aria-hidden className="size-5 shrink-0 text-secondary" /><Text>{tenant.address ?? "Адрес уточняется"}</Text></HStack><HStack gap={3} align="start"><Clock3 aria-hidden className="size-5 shrink-0 text-secondary" /><VStack gap={1}><Text>{today ? `Сегодня ${today.start_time.slice(0, 5)}–${today.end_time.slice(0, 5)}` : "Сегодня выходной"}</Text><Text size="sm" color="secondary">По времени студии</Text></VStack></HStack>{tenant.phone && <a href={`tel:${tenant.phone}`}><HStack gap={3} align="center"><Phone aria-hidden className="size-5 text-secondary" /><Text>{tenant.phone}</Text></HStack></a>}{tenant.address && <Button label="Открыть на карте" variant="secondary" href={`https://yandex.ru/maps/?text=${encodeURIComponent(tenant.address)}`} />}</VStack></Card>
        <Card padding={5}><VStack gap={3}><Smartphone aria-hidden className="size-6 text-accent" /><Text weight="semibold">Студия всегда под рукой</Text><Text size="sm" color="secondary">Добавьте сайт на главный экран телефона и возвращайтесь к записи в одно касание.</Text><Link to={`${base}/install`} className="text-sm text-accent">Как установить →</Link></VStack></Card>
      </VStack>
    </Grid>
    {booking && <BookingFlow />}
  </VStack>;
}
function Metric({ value, label }: { value: string; label: string }) { return <VStack gap={2} padding={4} className="rounded-xl border border-border bg-surface"><Text weight="bold" className="text-base sm:text-xl">{value}</Text><Text color="secondary" size="sm">{label}</Text></VStack>; }
