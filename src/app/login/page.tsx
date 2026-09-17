import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-16 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">SiteWell-ct</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in to your organization&apos;s workspace
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
