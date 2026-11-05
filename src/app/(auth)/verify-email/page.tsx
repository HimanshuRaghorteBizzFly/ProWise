"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      toast.error("Please enter the verification code sent to your email.");
      return;
    }

    setIsVerified(true);
    toast.success("Email verified successfully!");
    setTimeout(() => {
      router.push("/select-workspace");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
            ProWise
          </span>
          <h1 className="text-xl font-bold mt-2">Verify your email</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            We sent a verification code to your email address.
          </p>
        </div>

        <Card className="p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isVerified ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold">Account Verified</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Taking you to workspace setup...
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Verification Code
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. 742918"
                    className="pl-9 tracking-widest text-center font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <span>Confirm Verification</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => toast.info("A fresh verification code was resent.")}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Resend verification code
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

