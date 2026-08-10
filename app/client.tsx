"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Lock, AlertCircle } from "lucide-react";
import Image from "next/image";

export function HomeClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background Effects */}
      <div className="bg-grid-pattern absolute inset-0 opacity-[0.02]" />
      <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-primary-100 opacity-10 mix-blend-multiply blur-3xl" />
      <div className="absolute right-1/4 top-3/4 size-96 rounded-full bg-secondary-100 opacity-10 mix-blend-multiply blur-3xl" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <Card variant="default" className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex justify-center"
            >
              <Image
                src="/logo.png"
                alt="Jaro.dev"
                width={64}
                height={64}
                className="rounded-2xl shadow-lg"
              />
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <CardTitle className="text-3xl font-bold text-primary-600">
                Welcome Back
              </CardTitle>
              <CardDescription className="mt-2 text-secondary-600">
                Sign in to access your workspace
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4 text-danger-700"
                >
                  <AlertCircle className="size-5 shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="space-y-2"
              >
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-secondary-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-secondary-200 bg-white py-3 pl-10 pr-4
                      text-secondary-900 transition-all duration-200 placeholder:text-secondary-400
                      hover:border-secondary-300 focus:border-primary-500 focus:ring-2
                      focus:ring-primary-500/20"
                    placeholder="Enter your email"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="space-y-2"
              >
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-secondary-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-secondary-200 bg-white py-3 pl-10 pr-4
                      text-secondary-900 transition-all duration-200 placeholder:text-secondary-400
                      hover:border-secondary-300 focus:border-primary-500 focus:ring-2
                      focus:ring-primary-500/20"
                    placeholder="Enter your password"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </motion.div>
            </form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="text-center"
            >
              <p className="text-sm text-secondary-500">
                <span className="font-semibold text-primary-600">
                  Jaro.dev {" "}
                </span>
                Studio©
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
