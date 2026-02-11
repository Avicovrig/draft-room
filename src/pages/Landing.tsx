import { Link } from 'react-router-dom'
import { Zap, Users, Eye, Smartphone, Clock, Trophy } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Real-Time Drafts',
    description: 'Live pick updates across all devices with automatic timer management',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Easily add players, assign captains, and organize your league',
  },
  {
    icon: Eye,
    title: 'Spectator Mode',
    description: 'Share links so anyone can watch the draft unfold live',
  },
  {
    icon: Smartphone,
    title: 'Mobile Friendly',
    description: 'Draft from anywhere on any device with our responsive design',
  },
]

const steps = [
  {
    number: 1,
    title: 'Create Your League',
    description: 'Set up your league with custom draft settings and time limits',
  },
  {
    number: 2,
    title: 'Add Players & Captains',
    description: 'Import your player pool and designate team captains',
  },
  {
    number: 3,
    title: 'Draft Live',
    description: 'Run your draft in real-time with automatic pick timers',
  },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />

        {/* Decorative elements */}
        <div className="absolute left-1/4 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-20 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

        <div className="container relative mx-auto max-w-4xl text-center">
          {/* Animated icon */}
          <div className="mb-6 inline-flex animate-bounce-slow">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Draft<span className="text-primary">Room</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-muted-foreground">
            Run live fantasy drafts with your friends. Real-time picks, automatic timers, and
            spectator links for everyone.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              Get Started Free
            </Link>
            <Link
              to="/auth/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background/80 px-8 text-base font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sign In
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>15s - 30min pick timers</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>2-4 team captains</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Snake or round-robin</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-y border-border/50 bg-muted/30 px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Everything you need for draft day
          </h2>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Get drafting in minutes</h2>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative text-center">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-gradient-to-r from-primary/50 to-primary/20 md:block" />
                )}

                <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
                  {step.number}
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              Create Your First League
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
