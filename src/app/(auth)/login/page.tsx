"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.signin({ email, password });
      toast.success("Signed in successfully.");
      router.push("/select-org");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary">
            Sign in to ProWise
          </h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Google Workspace-inspired Project Delivery SaaS
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 shadow-modal">
          <form onSubmit={handleCustomLogin} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-app-text-secondary">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

        </Card>

        {/* Signup Link */}
        <p className="text-center text-xs text-app-text-secondary mt-6">
          Don&apos;t have an organization workspace?{" "}
          <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
            Create an organization
          </Link>
        </p>
      </div>
    </div>
  );
}

