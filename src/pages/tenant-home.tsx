import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Grid, Heading, HStack, Text, VStack } from "@astryxdesign/core";
import { ArrowUpRight, Clock3, MapPin, Phone, Smartphone } from "lucide-react";
import { useTenant } from "@/features/tenant/context";
import { money, durationLabel } from "@/lib/utils";
import { BookingFlow } from "./booking-flow";
import { PixelGlow } from "@/components/pixel-glow";

export function TenantHome({ booking = false }: { booking?: boolean }) {
  const { tenant, services, hours, assets, settings } = useTenant();
  const location = useLocation(); const navigate = useNavigate();
  const catalog = location.pathname.replace(/\/+$/, "").endsWith("/services");
  const base = `/s/${tenant.slug}`;
  const hero = tenant.hero_url ?? assets.find((asset) => asset.type === "hero")?.public_url;
  const gallery = assets.filter((asset) => asset.type === "gallery");
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tenant.timezone, weekday: "short" }).format(new Date());
  const today = hours.find((h) => h.weekday === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) && h.active);
  const startingPrice = services.length ? Math.min(...services.map((s) => s.price)) : null;
  return <VStack gap={8}>
    {!catalog && <>
      <VStack className="relative overflow-hidden rounded-[var(--radius-page)]" height={360} justify="end" padding={5}>
        {hero && <img src={hero} alt="Автомобиль студии" fetchPriority="high" className="absolute inset-0 size-full object-cover" />}
        <VStack className="absolute inset-0 bg-gradient-to-t from-body via-body/20 to-transparent" aria-hidden />
        <VStack className="relative"><Button variant="primary" label={settings.booking_enabled ? "Записаться" : "Онлайн-запись временно закрыта"} size="lg" width="100%" isDisabled={!settings.booking_enabled} onClick={() => navigate(`${base}/book`)} icon={<ArrowUpRight />} /></VStack>
      </VStack>
      <VStack gap={3}><Heading level={1}>{tenant.name}</Heading><Text color="secondary" className="max-w-2xl">{tenant.description}</Text></VStack>
      <Grid columns={3} gap={3}><Metric value={String(services.length)} label="услуги в прайсе" /><Metric value={today ? `${today.start_time.slice(0, 5)}–${today.end_time.slice(0, 5)}` : "Закрыто"} label="сегодня, время студии" /><Metric value={startingPrice === null ? "—" : `от ${money(startingPrice, tenant.currency)}`} label="за услугу" /></Grid>
    </>}
    <Grid columns={1} gap={6} className="lg:grid-cols-3">
      <VStack gap={8} className="min-w-0 lg:col-span-2">
        <VStack gap={4} as="section">
          <HStack align="center" justify="between"><Heading level={catalog ? 1 : 2}>Услуги</Heading><Link to={catalog ? base : `${base}/services`} className="text-sm text-accent">{catalog ? "На главную" : "Все услуги"} <ArrowUpRight className="inline size-4" aria-hidden /></Link></HStack>
          <Grid columns={1} gap={3} className="sm:grid-cols-2">{services.map((service) => <Card key={service.id} padding={5} className="flex h-full flex-col justify-between gap-5 transition-colors hover:border-accent-bg"><VStack gap={4}><HStack justify="between" align="start" gap={3}><VStack gap={2}><Text weight="semibold" size="lg">{service.name}</Text><Text size="sm" color="secondary">{service.description}</Text></VStack><ArrowUpRight aria-hidden className="size-5 shrink-0 text-accent" /></HStack><HStack gap={2} align="center"><Clock3 aria-hidden className="size-4 text-secondary" /><Text size="sm" color="secondary">{durationLabel(service.duration_minutes)}</Text><Text size="sm" color="secondary">·</Text><Text size="sm" color="secondary">{money(service.price, service.currency)}</Text></HStack></VStack><Button variant="secondary" label="Выбрать" aria-label={`Выбрать ${service.name}`} width="100%" onClick={() => navigate(`${base}/book?service=${service.id}`)} /></Card>)}</Grid>
          {!services.length && <Text color="secondary">Услуги скоро появятся.</Text>}
        </VStack>
        {!catalog && <VStack gap={4} as="section"><HStack justify="between" align="center"><Heading level={2}>Работы студии</Heading><Text size="sm" color="secondary">{gallery.length} фото</Text></HStack>{gallery.length ? <Grid columns={{ minWidth: 220 }} gap={3}>{gallery.map((asset) => <Card key={asset.public_url} padding={0} className="overflow-hidden"><img src={asset.public_url} alt={asset.alt_text ?? "Работа студии"} loading="lazy" className="aspect-[4/3] w-full object-cover" /><Text className="p-4" size="sm" color="secondary">{asset.alt_text ?? "Работа студии"}</Text></Card>)}</Grid> : <Card padding={5}><Text color="secondary">Галерея появится здесь после добавления фотографий.</Text></Card>}</VStack>}
      </VStack>
      <VStack gap={4} as="aside">
        <PromoCard title={tenant.content?.promo_title || "Свежий вид для вашего авто"} body={tenant.content?.promo_body || "Выберите услугу и удобное время — остальное возьмём на себя"} action={<Button variant="primary" label={tenant.content?.promo_button || "Выбрать время"} width="100%" isDisabled={!settings.booking_enabled} onClick={() => navigate(`${base}/book`)} icon={<ArrowUpRight />} />} />
        <Card padding={5}><VStack gap={5}><Heading level={3}>Контакты</Heading><HStack gap={3} align="start"><MapPin aria-hidden className="size-5 shrink-0 text-secondary" /><Text>{tenant.address ?? "Адрес уточняется"}</Text></HStack><HStack gap={3} align="start"><Clock3 aria-hidden className="size-5 shrink-0 text-secondary" /><VStack gap={1}><Text>{today ? `Сегодня ${today.start_time.slice(0, 5)}–${today.end_time.slice(0, 5)}` : "Сегодня выходной"}</Text><Text size="sm" color="secondary">По времени студии</Text></VStack></HStack>{tenant.phone && <a href={`tel:${tenant.phone}`}><HStack gap={3} align="center"><Phone aria-hidden className="size-5 text-secondary" /><Text>{tenant.phone}</Text></HStack></a>}{tenant.address && <Button variant="secondary" label="Открыть на карте" href={`https://yandex.ru/maps/?text=${encodeURIComponent(tenant.address)}`} />}</VStack></Card>
        <PromoCard brand={tenant.name} icon={<Smartphone />} title={tenant.content?.install_title || "Студия всегда под рукой."} body={tenant.content?.install_body || "Записывайтесь за несколько касаний, без поиска ссылки и звонков."} action={<Button variant="primary" label="Добавить на экран" width="100%" href={`${base}/install`} icon={<ArrowUpRight />} />} footnote="Бесплатно. Установка через браузер." />
      </VStack>
    </Grid>
    {booking && <BookingFlow />}
  </VStack>;
}

function PromoCard({ brand, icon, title, body, action, footnote }: { brand?: string; icon?: React.ReactNode; title: string; body: string; action: React.ReactNode; footnote?: string }) {
  return <Card padding={5} className="relative overflow-hidden bg-body">
    <PixelGlow phase={brand ? 1.6 : 0} />
    <VStack gap={4} className="relative">
      {brand && <HStack gap={3} align="center"><HStack padding={3} className="rounded-xl bg-accent-bg text-on-accent">{icon}</HStack><VStack gap={1}><Text weight="semibold">{brand}</Text><Text size="sm" color="secondary">Приложение студии</Text></VStack></HStack>}
      <VStack gap={2}><Heading level={2} className={brand ? "max-w-xs text-3xl leading-tight" : undefined}>{title}</Heading><Text color="secondary">{body}</Text></VStack>{action}{footnote && <Text size="sm" color="secondary">{footnote}</Text>}
    </VStack>
  </Card>;
}
function Metric({ value, label }: { value: string; label: string }) { return <Card padding={4}><VStack gap={2}><Text weight="bold" size="xl">{value}</Text><Text color="secondary" size="sm">{label}</Text></VStack></Card>; }
