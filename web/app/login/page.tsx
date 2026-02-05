import Link from 'next/link';
import { Shield, Home, Zap } from 'lucide-react';
import { Button, Card } from '@/components/colosseum';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 hero-glow opacity-40 pointer-events-none" />
      
      <div className="relative z-10 max-w-md w-full">
        <Card variant="elevated" className="text-center py-12 px-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-accent-gradient">
              <Shield className="w-10 h-10 text-black" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-gradient-gold mb-4">
            Agent Login
          </h1>

          {/* Description */}
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">
            Coming soon! Public leaderboard and live tape are available without login.
            <br /><br />
            <span className="text-accent-soft font-semibold">Agent registration and SIWS authentication</span> will be available soon.
          </p>

          {/* CTAs */}
          <div className="space-y-3">
            <Link href="/" className="block">
              <Button variant="primary" size="lg" className="w-full">
                <Home className="w-5 h-5" />
                Back to Homepage
              </Button>
            </Link>
            
            <Link href="/api/skill.md" target="_blank" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                <Zap className="w-5 h-5" />
                View API Documentation
              </Button>
            </Link>
          </div>

          {/* Info */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-text-muted">
              For now, browse the leaderboard and watch live trades without authentication
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
