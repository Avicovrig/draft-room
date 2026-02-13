import { Link } from 'react-router-dom'
import {
  Zap,
  Settings,
  Eye,
  Trophy,
  Timer,
  ListOrdered,
  Keyboard,
  Bell,
  FileSpreadsheet,
  Palette,
  UserPen,
  Copy,
  BarChart3,
  Download,
  Moon,
  Smartphone,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const featureCategories = [
  {
    icon: Zap,
    title: 'Draft Day',
    description: 'Everything you need for a smooth, fair draft.',
    features: [
      { icon: ListOrdered, label: 'Snake & round-robin drafts' },
      { icon: Timer, label: 'Configurable pick timers' },
      { icon: Zap, label: 'Auto-pick on timeout' },
      { icon: ListOrdered, label: 'Draft queue for captains' },
      { icon: Keyboard, label: 'Keyboard shortcuts' },
      { icon: Bell, label: 'Browser notifications' },
    ],
  },
  {
    icon: Settings,
    title: 'League Setup',
    description: 'Customize every detail of your league.',
    features: [
      { icon: Settings, label: 'Custom player fields (6 types)' },
      { icon: FileSpreadsheet, label: 'CSV / XLSX import' },
      { icon: Palette, label: 'Captain team customization' },
      { icon: UserPen, label: 'Player self-service profiles' },
      { icon: Copy, label: 'Copy & duplicate leagues' },
      { icon: CalendarClock, label: 'Scheduled draft starts' },
    ],
  },
  {
    icon: Eye,
    title: 'Experience',
    description: 'A polished experience for everyone involved.',
    features: [
      { icon: Eye, label: 'Spectator mode' },
      { icon: BarChart3, label: 'Draft summary' },
      { icon: Download, label: 'Export results' },
      { icon: Moon, label: 'Dark mode' },
      { icon: Smartphone, label: 'Mobile-responsive' },
      { icon: CalendarClock, label: 'Real-time updates' },
    ],
  },
]

const steps = [
  {
    number: 1,
    title: 'Create League',
    description: 'Set up draft type, timers, and custom player fields.',
  },
  {
    number: 2,
    title: 'Add Players & Fields',
    description: 'Import your player pool via CSV or add them manually.',
  },
  {
    number: 3,
    title: 'Share Links',
    description: 'Send captain and spectator links — no accounts needed.',
  },
  {
    number: 4,
    title: 'Draft Live',
    description: 'Run your draft in real-time with auto-pick and timers.',
  },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="h-5 w-5 text-primary" />
            Draft<span className="text-primary">Room</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/auth/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log In
            </Link>
            <Link
              to="/auth/signup"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28 lg:py-36">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-20 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

        <div className="container relative mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">
            Your Draft Day, <span className="text-primary">Simplified</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Run live fantasy drafts with your friends. Real-time picks, automatic timers, captain
            links, and spectator mode — no app install required.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              to="/auth/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background/80 px-8 text-base font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sign In
            </Link>
          </div>

          {/* Stat strip */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-primary/70" />
              <span>Snake & round-robin</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary/70" />
              <span>6 custom field types</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary/70" />
              <span>Real-time updates</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="border-y border-border/50 bg-muted/30 px-4 py-16 sm:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything you need for draft day</h2>
            <p className="mt-3 text-muted-foreground">
              From league setup to live drafting, Draft Room handles it all.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featureCategories.map((category) => (
              <div
                key={category.title}
                className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <category.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 text-lg font-semibold">{category.title}</h3>
                <p className="mb-4 text-sm text-muted-foreground">{category.description}</p>
                <ul className="space-y-2">
                  {category.features.map((feature) => (
                    <li
                      key={feature.label}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <feature.icon className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 sm:py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
            Get drafting in minutes
          </h2>

          {/* Desktop: horizontal timeline */}
          <div className="hidden md:block">
            <div className="grid grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div key={step.number} className="relative text-center">
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-1/2 top-8 h-0.5 w-full bg-gradient-to-r from-primary/50 to-primary/20" />
                  )}
                  <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
                    {step.number}
                  </div>
                  <h3 className="mb-2 font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical stack */}
          <div className="space-y-6 md:hidden">
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex gap-4">
                {/* Vertical line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-5 top-12 h-[calc(100%-12px)] w-0.5 bg-gradient-to-b from-primary/50 to-primary/20" />
                )}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
                  {step.number}
                </div>
                <div className="pt-1.5">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready for draft day?</h2>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
              Create your league in minutes. No credit card, no app install.
            </p>
            <Link
              to="/auth/signup"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-background px-8 text-base font-medium text-foreground shadow transition-colors hover:bg-background/90"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-sm text-muted-foreground">Built for draft day</p>
        </div>
      </footer>
    </div>
  )
}
