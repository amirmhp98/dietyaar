'use client';

import { ProductGallery } from './product-gallery';
import { ProductUiGallery } from './product-ui-gallery';

import { useState, useRef } from 'react';
import {
  // Layout & Display
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  // Buttons & Inputs
  Button,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Slider,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  // Tabs
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  // Data display
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Skeleton,
  Spinner,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
  Separator,
  ScrollArea,
  // Table
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  // Navigation
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
  // OTP
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  // Overlays
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  // Steppers
  Stepper,
  DotStepper,
  ProgressStepper,
  // Calendar
  Calendar,
  DatePicker,
  DateRangePicker,
  type DateRange,
} from '@/components/UiComponents';
import { SectionHeader } from '@/components/common/SectionHeader';
import { formatDate } from '@/lib/format';
import { locale } from '@/lib/locale';
import {
  Palette,
  Type,
  Square,
  AlignLeft,
  Bell,
  Database,
  Navigation,
  Layers,
  LayoutGrid,
  BarChart2,
  Settings,
  ChevronRight,
  BarChart3,
  FileImage,
  HeartPulse,
  MessageCircle,
  Newspaper,
  Search,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Share2,
  Star,
  Heart,
  Eye,
  Users,
  FileText,
  TrendingUp,
  Clock,
  Calendar as CalendarIcon,
  Home,
  ArrowLeft,
  Check,
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  List,
  CalendarDays,
  XCircle,
  Zap,
  Globe,
  Lock,
  Unlock,
  Mail,
  Phone,
  Cpu,
  Utensils,
} from 'lucide-react';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 1, title: 'اطلاعات پایه', description: 'عنوان و توضیحات' },
  { id: 2, title: 'فیلترها', description: 'تعریف معیارها' },
  { id: 3, title: 'تأیید نهایی', description: 'بررسی و ذخیره' },
];

const TOKEN_COLORS = [
  { name: 'background', label: 'Background' },
  { name: 'foreground', label: 'Foreground' },
  { name: 'primary', label: 'Primary' },
  { name: 'primary-foreground', label: 'Primary FG' },
  { name: 'secondary', label: 'Secondary' },
  { name: 'muted', label: 'Muted' },
  { name: 'muted-foreground', label: 'Muted FG' },
  { name: 'accent', label: 'Accent' },
  { name: 'destructive', label: 'Destructive' },
  { name: 'border', label: 'Border' },
  { name: 'card', label: 'Card' },
  { name: 'popover', label: 'Popover' },
];

const LUCIDE_ICONS = [
  { name: 'Search', icon: Search },
  { name: 'Plus', icon: Plus },
  { name: 'Trash2', icon: Trash2 },
  { name: 'Edit', icon: Edit },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'Share2', icon: Share2 },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Eye', icon: Eye },
  { name: 'Users', icon: Users },
  { name: 'FileText', icon: FileText },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'Clock', icon: Clock },
  { name: 'Calendar', icon: CalendarIcon },
  { name: 'Home', icon: Home },
  { name: 'ArrowLeft', icon: ArrowLeft },
  { name: 'Check', icon: Check },
  { name: 'X', icon: X },
  { name: 'Info', icon: Info },
  { name: 'AlertTriangle', icon: AlertTriangle },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'Zap', icon: Zap },
  { name: 'Globe', icon: Globe },
  { name: 'Lock', icon: Lock },
  { name: 'Unlock', icon: Unlock },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Cpu', icon: Cpu },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'FileImage', icon: FileImage },
  { name: 'HeartPulse', icon: HeartPulse },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Newspaper', icon: Newspaper },
  { name: 'Settings', icon: Settings },
  { name: 'ChevronRight', icon: ChevronRight },
  { name: 'BarChart2', icon: BarChart2 },
  { name: 'Layers', icon: Layers },
];

const SECTIONS = [
  { id: 'product', label: 'Product UI', icon: Utensils },
  { id: 'tokens', label: 'توکن‌های طراحی', icon: Palette },
  { id: 'typography', label: 'تایپوگرافی', icon: Type },
  { id: 'buttons', label: 'دکمه‌ها', icon: Square },
  { id: 'forms', label: 'فرم‌ها', icon: AlignLeft },
  { id: 'feedback', label: 'بازخورد', icon: Bell },
  { id: 'display', label: 'نمایش داده', icon: Database },
  { id: 'navigation', label: 'ناوبری', icon: Navigation },
  { id: 'overlays', label: 'لایه‌های رویه‌ای', icon: Layers },
  { id: 'calendar', label: 'تقویم', icon: CalendarDays },
  { id: 'steppers', label: 'استپرها', icon: LayoutGrid },
  { id: 'icons', label: 'آیکون‌ها', icon: Settings },
];

// ─── Sub-section wrapper ──────────────────────────────────────────────────────

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground border-b border-border/40 pb-2">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComponentsPage() {
  // State
  const [stepperStep, setStepperStep] = useState(0);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [pickedRange, setPickedRange] = useState<DateRange | undefined>(undefined);
  const [gregorianDate, setGregorianDate] = useState<Date | undefined>(undefined);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [sliderVal, setSliderVal] = useState([40]);
  const [radioVal, setRadioVal] = useState('option1');
  const [otpVal, setOtpVal] = useState('');
  const [progressVal] = useState(65);
  const [inputVal, setInputVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('');
  const [activeSection, setActiveSection] = useState('tokens');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <TooltipProvider>
      <div className="flex gap-0 min-h-screen">
        {/* ── Sticky nav ── */}
        <aside className="hidden xl:flex sticky top-14 h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col border-e border-border/40 bg-card/40 overflow-y-auto p-3 gap-1">
          <p className="text-2xs font-semibold text-muted-foreground/60 px-2 py-1.5 uppercase tracking-wider">
            بخش‌ها
          </p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-start transition-colors w-full ${
                activeSection === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <s.icon className="w-3.5 h-3.5 shrink-0" />
              <span>{s.label}</span>
            </button>
          ))}
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 min-w-0 p-6 md:p-8 space-y-16">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">کتابخانه کامپوننت‌ها</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              تمامی کامپوننت‌ها، آیکون‌ها و عناصر UI پروژه در یک صفحه تعاملی
            </p>
          </div>

          {/* ════════════════════════════════ PRODUCT ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['product'] = el;
            }}
          >
            <ProductUiGallery />
            <ProductGallery />
          </div>

          {/* ════════════════════════════════ TOKENS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['tokens'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Palette className="size-6" />}
              title="توکن‌های طراحی"
              description="رنگ‌ها، شعاع‌های گوشه، و سایه‌های تعریف‌شده در سیستم طراحی"
            />

            <ShowcaseSection title="رنگ‌های سمانتیک">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {TOKEN_COLORS.map(({ name, label }) => (
                  <div key={name} className="space-y-2">
                    <div
                      className="h-14 w-full rounded-lg border border-border/60 shadow-sm"
                      style={{ background: `hsl(var(--${name}))` }}
                    />
                    <p className="text-2xs text-muted-foreground font-mono text-center">{label}</p>
                    <p className="text-2xs text-muted-foreground/60 font-mono text-center">
                      --{name}
                    </p>
                  </div>
                ))}
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="شعاع گوشه (Border Radius)">
              <div className="flex flex-wrap gap-4 items-end">
                {[
                  { name: 'none', cls: 'rounded-none' },
                  { name: 'sm', cls: 'rounded-sm' },
                  { name: 'md', cls: 'rounded-md' },
                  { name: 'lg', cls: 'rounded-lg' },
                  { name: 'xl', cls: 'rounded-xl' },
                  { name: '2xl', cls: 'rounded-2xl' },
                  { name: 'full', cls: 'rounded-full' },
                ].map((r) => (
                  <div key={r.name} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-12 h-12 bg-primary/20 border-2 border-primary/40 ${r.cls}`}
                    />
                    <span className="text-2xs text-muted-foreground">{r.name}</span>
                  </div>
                ))}
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="سایه (Shadow)">
              <div className="flex flex-wrap gap-6 items-end">
                {[
                  { name: 'sm', cls: 'shadow-sm' },
                  { name: 'md', cls: 'shadow-md' },
                  { name: 'lg', cls: 'shadow-lg' },
                  { name: 'xl', cls: 'shadow-xl' },
                ].map((s) => (
                  <div key={s.name} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-20 h-12 bg-card rounded-lg border border-border/40 ${s.cls}`}
                    />
                    <span className="text-2xs text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ TYPOGRAPHY ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['typography'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Type className="size-6" />}
              title="تایپوگرافی"
              description="سطوح متنی، وزن‌ها، و رنگ‌های تعریف‌شده"
            />

            <ShowcaseSection title="اندازه‌های متن">
              <div className="space-y-4 p-4 bg-muted/10 rounded-xl border border-border/40">
                {[
                  { cls: 'text-2xs', label: 'text-2xs (10px)' },
                  { cls: 'text-xs', label: 'text-xs (12px)' },
                  { cls: 'text-sm', label: 'text-sm (14px)' },
                  { cls: 'text-base', label: 'text-base (16px)' },
                  { cls: 'text-lg', label: 'text-lg (18px)' },
                  { cls: 'text-xl', label: 'text-xl (20px)' },
                  { cls: 'text-2xl', label: 'text-2xl (24px)' },
                  { cls: 'text-3xl', label: 'text-3xl (30px)' },
                  { cls: 'text-4xl', label: 'text-4xl (36px)' },
                ].map((t) => (
                  <div key={t.cls} className="flex items-baseline gap-4">
                    <code className="text-2xs text-muted-foreground/60 w-40 shrink-0">
                      {t.label}
                    </code>
                    <span className={t.cls}>نمونه متن فارسی — Sample Text</span>
                  </div>
                ))}
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="وزن‌های فونت">
              <div className="flex flex-wrap gap-6 p-4 bg-muted/10 rounded-xl border border-border/40">
                {[
                  'font-light',
                  'font-normal',
                  'font-medium',
                  'font-semibold',
                  'font-bold',
                  'font-extrabold',
                ].map((w) => (
                  <div key={w} className="space-y-1">
                    <p className={`text-base ${w}`}>نمونه متن</p>
                    <code className="text-2xs text-muted-foreground/60">{w}</code>
                  </div>
                ))}
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="رنگ‌های متن">
              <div className="flex flex-wrap gap-4">
                {[
                  { cls: 'text-foreground', label: 'foreground' },
                  { cls: 'text-muted-foreground', label: 'muted-foreground' },
                  { cls: 'text-primary', label: 'primary' },
                  { cls: 'text-destructive', label: 'destructive' },
                  { cls: 'text-emerald-600', label: 'emerald-600' },
                ].map((c) => (
                  <div key={c.cls} className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${c.cls}`}>نمونه</span>
                    <code className="text-2xs text-muted-foreground/60">{c.label}</code>
                  </div>
                ))}
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ BUTTONS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['buttons'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Square className="size-6" />}
              title="دکمه‌ها"
              description="تمامی واریانت‌ها و اندازه‌های دکمه"
            />

            <ShowcaseSection title="واریانت‌ها">
              <div className="flex flex-wrap gap-3">
                <Button variant="default">پیش‌فرض</Button>
                <Button variant="secondary">ثانویه</Button>
                <Button variant="outline">خطدار</Button>
                <Button variant="ghost">شبح</Button>
                <Button variant="destructive">مخرب</Button>
                <Button variant="link">لینک</Button>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="اندازه‌ها">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">کوچک</Button>
                <Button size="default">معمولی</Button>
                <Button size="lg">بزرگ</Button>
                <Button size="icon" aria-label="جستجو">
                  <Search />
                </Button>
                <Button size="icon-sm" aria-label="جستجو">
                  <Search />
                </Button>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="حالت‌های ویژه">
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled>غیرفعال</Button>
                <Button className="gap-2">
                  <Spinner className="w-4 h-4" />
                  در حال بارگذاری
                </Button>
                <Button variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  با آیکون
                </Button>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  حذف
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  دانلود
                </Button>
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ FORMS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['forms'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<AlignLeft className="size-6" />}
              title="فرم‌ها"
              description="کنترل‌های ورودی و انتخاب"
            />

            <ShowcaseSection title="Input & Textarea">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ورودی معمولی</label>
                  <Input
                    placeholder="متن را وارد کنید..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">ورودی غیرفعال</label>
                  <Input placeholder="غیرفعال" disabled />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Textarea</label>
                  <Textarea
                    placeholder="متن بلند..."
                    value={textareaVal}
                    onChange={(e) => setTextareaVal(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Select">
              <div className="max-w-xs space-y-2">
                <label className="text-sm font-medium">انتخاب گزینه</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">گزینه اول</SelectItem>
                    <SelectItem value="b">گزینه دوم</SelectItem>
                    <SelectItem value="c">گزینه سوم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Checkbox & RadioGroup">
              <div className="flex flex-wrap gap-8">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Checkbox</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cb1"
                      checked={checkboxChecked}
                      onCheckedChange={(v) => setCheckboxChecked(!!v)}
                    />
                    <label htmlFor="cb1" className="text-sm">
                      گزینه اول (فعال)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cb2" />
                    <label htmlFor="cb2" className="text-sm">
                      گزینه دوم
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cb3" disabled />
                    <label htmlFor="cb3" className="text-sm text-muted-foreground">
                      غیرفعال
                    </label>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium">RadioGroup</p>
                  <RadioGroup value={radioVal} onValueChange={setRadioVal}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option1" id="r1" />
                      <label htmlFor="r1" className="text-sm">
                        گزینه اول
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option2" id="r2" />
                      <label htmlFor="r2" className="text-sm">
                        گزینه دوم
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="option3" id="r3" />
                      <label htmlFor="r3" className="text-sm">
                        گزینه سوم
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Switch & Slider">
              <div className="flex flex-wrap gap-8">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Switch</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
                    <span className="text-sm">{switchOn ? 'فعال' : 'غیرفعال'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch disabled />
                    <span className="text-sm text-muted-foreground">غیرفعال</span>
                  </div>
                </div>
                <div className="space-y-3 w-64">
                  <p className="text-sm font-medium">Slider — مقدار: {sliderVal[0]}</p>
                  <Slider
                    value={sliderVal}
                    onValueChange={setSliderVal}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="InputOTP">
              <div className="space-y-2">
                <p className="text-sm font-medium">کد یک‌بارمصرف</p>
                <InputOTP maxLength={6} value={otpVal} onChange={setOtpVal}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ FEEDBACK ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['feedback'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Bell className="size-6" />}
              title="بازخورد"
              description="Badge، Alert، Spinner، Progress، Skeleton"
            />

            <ShowcaseSection title="Badge">
              <div className="flex flex-wrap gap-2">
                <Badge>پیش‌فرض</Badge>
                <Badge variant="secondary">ثانویه</Badge>
                <Badge variant="outline">خطدار</Badge>
                <Badge variant="destructive">مخرب</Badge>
                <Badge
                  style={{ background: '#6366f115', borderColor: '#6366f130', color: '#6366f1' }}
                  variant="outline"
                >
                  رنگ سفارشی
                </Badge>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Alert">
              <div className="space-y-3 max-w-lg">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>اطلاعات</AlertTitle>
                  <AlertDescription>این یک پیام اطلاعاتی است.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>خطا</AlertTitle>
                  <AlertDescription>مشکلی رخ داده است. لطفاً دوباره امتحان کنید.</AlertDescription>
                </Alert>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Spinner & Progress">
              <div className="flex flex-wrap items-center gap-8">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Spinner</p>
                  <div className="flex items-center gap-4">
                    <Spinner className="w-4 h-4" />
                    <Spinner className="w-6 h-6" />
                    <Spinner className="w-8 h-8" />
                  </div>
                </div>
                <div className="space-y-2 w-64">
                  <p className="text-xs text-muted-foreground">Progress — {progressVal}%</p>
                  <Progress value={progressVal} />
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Skeleton">
              <div className="space-y-3 max-w-sm">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ DISPLAY ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['display'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Database className="size-6" />}
              title="نمایش داده"
              description="Card، Avatar، Table، ScrollArea، Separator"
            />

            <ShowcaseSection title="Card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle>عنوان کارت</CardTitle>
                    <CardDescription>توضیحات کوتاه در اینجا نوشته می‌شود</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      محتوای اصلی کارت در این بخش قرار می‌گیرد.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-primary">کارت رنگی</CardTitle>
                    <CardDescription>با رنگ سفارشی از طریق className</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm">عمل</Button>
                  </CardContent>
                </Card>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Avatar">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">CD</AvatarFallback>
                </Avatar>
                <Avatar className="h-12 w-12">
                  <AvatarImage src="/avatars/01.png" alt="User" />
                  <AvatarFallback>EF</AvatarFallback>
                </Avatar>
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">GH</AvatarFallback>
                </Avatar>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Table">
              <div className="rounded-xl border border-border/40 overflow-hidden max-w-2xl">
                <Table>
                  <TableCaption>فهرست نمونه</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام</TableHead>
                      <TableHead>دسته‌بندی</TableHead>
                      <TableHead>فالوور</TableHead>
                      <TableHead>تعامل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { name: 'example_page', cat: 'محتوا', followers: '284K', rate: '3.7%' },
                      { name: 'news_account', cat: 'خبری', followers: '1.2M', rate: '1.2%' },
                      { name: 'lifestyle_ig', cat: 'سبک زندگی', followers: '560K', rate: '4.1%' },
                    ].map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium" dir="ltr">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.cat}</TableCell>
                        <TableCell>{row.followers}</TableCell>
                        <TableCell className="text-emerald-600">{row.rate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Separator & ScrollArea">
              <div className="flex flex-wrap gap-8">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Separator — Horizontal</p>
                  <div className="w-48 space-y-2">
                    <p className="text-sm">بالا</p>
                    <Separator />
                    <p className="text-sm">پایین</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">ScrollArea</p>
                  <ScrollArea className="h-24 w-48 rounded-md border p-2">
                    {Array.from({ length: 10 }, (_, i) => (
                      <p key={i} className="text-sm py-1 text-muted-foreground">
                        آیتم {i + 1}
                      </p>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ NAVIGATION ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['navigation'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Navigation className="size-6" />}
              title="ناوبری"
              description="Tabs، Breadcrumb، Pagination، Toggle"
            />

            <ShowcaseSection title="Tabs — واریانت‌ها">
              <div className="space-y-6">
                {(['solid', 'underline', 'pills'] as const).map((variant) => (
                  <div key={variant} className="space-y-2">
                    <p className="text-xs text-muted-foreground font-mono">
                      variant=&quot;{variant}&quot;
                    </p>
                    <Tabs defaultValue="tab1">
                      <TabsList variant={variant}>
                        <TabsTrigger value="tab1">اول</TabsTrigger>
                        <TabsTrigger value="tab2">دوم</TabsTrigger>
                        <TabsTrigger value="tab3">سوم</TabsTrigger>
                      </TabsList>
                      <TabsContent value="tab1" className="p-3 text-sm text-muted-foreground">
                        محتوای تب اول
                      </TabsContent>
                      <TabsContent value="tab2" className="p-3 text-sm text-muted-foreground">
                        محتوای تب دوم
                      </TabsContent>
                      <TabsContent value="tab3" className="p-3 text-sm text-muted-foreground">
                        محتوای تب سوم
                      </TabsContent>
                    </Tabs>
                  </div>
                ))}
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Breadcrumb">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">خانه</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">بخش نمونه</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbPage>نتایج</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </ShowcaseSection>

            <ShowcaseSection title="Toggle & ToggleGroup">
              <div className="flex flex-wrap gap-4">
                <Toggle>تاریخچه</Toggle>
                <Toggle variant="outline">خطدار</Toggle>
                <ToggleGroup type="single" defaultValue="grid">
                  <ToggleGroupItem value="grid">
                    <LayoutGrid className="w-4 h-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list">
                    <List className="w-4 h-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="Pagination">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive>
                      ۱
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">۲</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">۳</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ OVERLAYS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['overlays'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Layers className="size-6" />}
              title="لایه‌های رویه‌ای"
              description="Dialog، Sheet، Popover، Tooltip، DropdownMenu"
            />

            <ShowcaseSection title="Dialog">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">باز کردن Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>عنوان دیالوگ</DialogTitle>
                    <DialogDescription>توضیحات دیالوگ در اینجا قرار می‌گیرد.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 text-sm text-muted-foreground">محتوای بدنه دیالوگ</div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">انصراف</Button>
                    <Button>تأیید</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </ShowcaseSection>

            <ShowcaseSection title="Sheet">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">باز کردن Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>عنوان شیت</SheetTitle>
                    <SheetDescription>توضیحات در اینجا قرار می‌گیرد.</SheetDescription>
                  </SheetHeader>
                  <div className="py-4 text-sm text-muted-foreground">محتوای بدنه شیت</div>
                </SheetContent>
              </Sheet>
            </ShowcaseSection>

            <ShowcaseSection title="Popover & Tooltip">
              <div className="flex flex-wrap gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Popover</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <p className="text-sm">محتوای popover در اینجا قرار می‌گیرد.</p>
                  </PopoverContent>
                </Popover>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">هاور کنید</Button>
                  </TooltipTrigger>
                  <TooltipContent>این یک Tooltip است</TooltipContent>
                </Tooltip>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="DropdownMenu">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">منو</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>عملیات</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>ویرایش</DropdownMenuItem>
                  <DropdownMenuItem>کپی</DropdownMenuItem>
                  <DropdownMenuItem>اشتراک‌گذاری</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">حذف</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ CALENDAR ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['calendar'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<CalendarDays className="size-6" />}
              title="تقویم و انتخاب تاریخ"
              description={`تقویم پیش‌فرض این استقرار: ${locale.calendar === 'persian' ? 'جلالی' : 'میلادی'} (${locale.tag}). مقدارها همیشه Date/ISO هستند؛ تقویم فقط نمایش است.`}
            />

            <ShowcaseSection title="Calendar — inline (پیش‌فرض پروفایل)">
              <div className="flex flex-wrap gap-6">
                <div className="rounded-lg border border-border/60">
                  <Calendar mode="single" selected={pickedDate} onSelect={setPickedDate} />
                </div>
                <div className="rounded-lg border border-border/60">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={pickedDate}
                    onSelect={setPickedDate}
                  />
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="DatePicker و DateRangePicker">
              <div className="flex flex-wrap items-start gap-4">
                <div className="space-y-2">
                  <DatePicker value={pickedDate} onChange={setPickedDate} />
                  <p className="text-xs text-muted-foreground">
                    {pickedDate
                      ? `میلادی: ${formatDate(pickedDate, { calendar: 'gregory', numerals: 'latn' })}`
                      : 'مقداری انتخاب نشده'}
                  </p>
                </div>
                <div className="space-y-2">
                  <DateRangePicker value={pickedRange} onChange={setPickedRange} />
                  <p className="text-xs text-muted-foreground">
                    {pickedRange?.from
                      ? `${formatDate(pickedRange.from)}${pickedRange.to ? ` ← ${formatDate(pickedRange.to)}` : ''}`
                      : 'بازه‌ای انتخاب نشده'}
                  </p>
                </div>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title='Override برای یک فیلد — calendar="gregory"'>
              <p className="text-xs text-muted-foreground mb-3">
                برای فیلدهایی مثل تاریخ انقضای پاسپورت یا قرارداد خارجی، تقویم را فقط برای همان فیلد
                عوض کنید. برچسب‌ها همچنان به زبان پروفایل هستند.
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <DatePicker calendar="gregory" value={gregorianDate} onChange={setGregorianDate} />
                <DatePicker calendar="persian" value={gregorianDate} onChange={setGregorianDate} />
                <p className="text-xs text-muted-foreground self-center">
                  {gregorianDate
                    ? `همان مقدار در دو تقویم: ${formatDate(gregorianDate, { calendar: 'gregory' })} = ${formatDate(gregorianDate, { calendar: 'persian' })}`
                    : 'یک تاریخ انتخاب کنید'}
                </p>
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ STEPPERS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['steppers'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<LayoutGrid className="size-6" />}
              title="استپرها"
              description="Stepper، DotStepper، ProgressStepper — تعاملی"
            />

            <ShowcaseSection title="Stepper — افقی (تعاملی)">
              <div className="space-y-4 p-4 bg-muted/10 rounded-xl border border-border/40">
                <Stepper steps={WIZARD_STEPS} activeStep={stepperStep} />
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStepperStep((s) => Math.max(0, s - 1))}
                    disabled={stepperStep === 0}
                  >
                    قبلی
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStepperStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
                    disabled={stepperStep === WIZARD_STEPS.length - 1}
                  >
                    بعدی
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setStepperStep(0)}>
                    ریست
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  مرحله فعال: {stepperStep + 1} از {WIZARD_STEPS.length} —{' '}
                  {WIZARD_STEPS[stepperStep].title}
                </p>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="DotStepper">
              <div className="space-y-3 p-4 bg-muted/10 rounded-xl border border-border/40">
                <DotStepper steps={WIZARD_STEPS} activeStep={stepperStep} />
                <p className="text-xs text-muted-foreground text-center">
                  مرحله {stepperStep + 1} از {WIZARD_STEPS.length}
                </p>
              </div>
            </ShowcaseSection>

            <ShowcaseSection title="ProgressStepper">
              <div className="max-w-sm p-4 bg-muted/10 rounded-xl border border-border/40">
                <ProgressStepper steps={WIZARD_STEPS} activeStep={stepperStep} />
              </div>
            </ShowcaseSection>
          </div>

          {/* ════════════════════════════════ ICONS ════════════════════════════════ */}
          <div
            ref={(el) => {
              sectionRefs.current['icons'] = el;
            }}
            className="space-y-8"
          >
            <SectionHeader
              icon={<Settings className="size-6" />}
              title="آیکون‌ها"
              description="Lucide React icons"
            />
            <ShowcaseSection title="Lucide Icons (در پروژه استفاده شده)">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {LUCIDE_ICONS.map(({ name, icon: IconComp }) => (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border/40 hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-default">
                        <IconComp className="w-5 h-5 text-muted-foreground" />
                        <span className="text-2xs text-muted-foreground/60 text-center leading-tight truncate w-full text-center">
                          {name}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <code className="text-xs">{name}</code>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </ShowcaseSection>{' '}
          </div>

          <div className="h-16" />
        </main>
      </div>
    </TooltipProvider>
  );
}
