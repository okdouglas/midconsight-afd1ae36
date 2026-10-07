import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MailCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
const nameSchema = z.string().min(1, 'Name is required');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const paidPlan = plan === 'starter' || plan === 'pro' ? plan : null;
  const isReset = searchParams.get('mode') === 'reset';
  const defaultTab = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const afterAuthPath = paidPlan ? `/app?upgrade=${paidPlan}` : '/app';
  const [view, setView] = useState<'tabs' | 'forgot'>('tabs');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        return;
      }
      if (session && !isReset) {
        navigate(afterAuthPath, { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionChecked(true);
      if (session && isReset) {
        setRecovery(true);
      } else if (session) {
        navigate(afterAuthPath, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, afterAuthPath, isReset]);

  const validateForm = (requireName: boolean) => {
    const newErrors: { email?: string; password?: string; fullName?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (requireName) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setLoading(true);
    
    // After the email link is clicked, land in the app (it signs the user in from the link).
    const redirectUrl = `${window.location.origin}/app`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          company_name: companyName || null,
          marketing_consent: marketingConsent,
        },
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message);
      }
    } else if (data.session) {
      // Email confirmation is off: the user is already signed in and the auth listener redirects.
      toast.success('Account created. Taking you to your dashboard.');
    } else {
      // Email confirmation is on: no session until the link in the email is clicked.
      setPendingEmail(email);
    }
    
    setLoading(false);
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error(error.message);
    else toast.success('Email sent again.');
    setResending(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setErrors({ email: result.error.errors[0].message });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('If that email has an account, a reset link is on its way.');
      setView('tabs');
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      setResetError(result.error.errors[0].message);
      return;
    }
    setResetError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated.');
    navigate('/app', { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please try again.');
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        toast.error('Please confirm your email first. Check your inbox for the link we sent.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo showCredit width={300} className="mx-auto mb-5" />
          <CardTitle className="sr-only">MidconSight</CardTitle>
          <CardDescription>Permit Intelligence Platform</CardDescription>
        </CardHeader>
        <CardContent>
          {recovery ? (
            <form onSubmit={handleReset} className="space-y-4">
              <h2 className="text-lg font-semibold">Set a new password</h2>
              <div className="space-y-2">
                <Label htmlFor="reset-password">New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setResetError(''); }}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                {resetError && <p className="text-sm text-destructive">{resetError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          ) : isReset && !sessionChecked ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" /></div>
          ) : isReset ? (
            <div className="space-y-4 text-center" role="status">
              <p className="text-sm text-muted-foreground">
                This reset link has expired or was already used. Ask for a new one.
              </p>
              <Button className="w-full" onClick={() => { navigate('/auth', { replace: true }); setView('forgot'); }}>
                Send a new link
              </Button>
            </div>
          ) : pendingEmail ? (
            <div className="space-y-4 text-center" role="status">
              <MailCheck className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{pendingEmail}</span>.
                Open it to finish setting up your account.
              </p>
              <Button variant="outline" className="w-full" onClick={handleResend} disabled={resending}>
                {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend email
              </Button>
              <button
                type="button"
                onClick={() => setPendingEmail(null)}
                className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Use a different email
              </button>
            </div>
          ) : view === 'forgot' ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="text-sm text-muted-foreground">Enter your email. We will send you a link to set a new password.</p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                  required
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
              <button
                type="button"
                onClick={() => setView('tabs')}
                className="block w-full text-center text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors({});
                    }}
                    required
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors({});
                    }}
                    required
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
                <button
                  type="button"
                  onClick={() => { setErrors({}); setView('forgot'); }}
                  className="block w-full text-center text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErrors({});
                    }}
                    required
                  />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-company">Company <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="signup-company"
                    type="text"
                    placeholder="Acme Land & Minerals"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors({});
                    }}
                    required
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors({});
                    }}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="marketing-consent"
                    checked={marketingConsent}
                    onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                  />
                  <Label htmlFor="marketing-consent" className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
                    Send me occasional emails about new features and permit activity. You can unsubscribe any time.
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
