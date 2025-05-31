"use client"

import { useState } from "react"
import { Check, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"

interface PricingFeature {
  text: string
  tooltip?: string
  included: boolean | string
}

interface PricingTier {
  name: string
  description: string
  price: {
    monthly: number
    annually: number
  }
  features: PricingFeature[]
  buttonText: string
  buttonVariant?: "default" | "outline" | "secondary"
  highlighted?: boolean
}

export function PricingPlans() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly")

  const pricingTiers: PricingTier[] = [
    {
      name: "Free",
      description: "For individuals exploring Claude's capabilities",
      price: {
        monthly: 0,
        annually: 0,
      },
      features: [
        { text: "3 Projects", included: true },
        { text: "10MB document upload per project", included: true },
        { text: "5 chat threads per project", included: true },
        { text: "Standard RAG processing", included: true },
        { text: "Claude 3.5 Sonnet access", included: true },
        { text: "Community support", included: true },
        {
          text: "Requires own Anthropic API key",
          tooltip: "You'll need to provide your own Anthropic API key",
          included: true,
        },
        { text: "Advanced document processing", included: false },
        { text: "Priority RAG indexing", included: false },
      ],
      buttonText: "Get Started",
      buttonVariant: "outline",
    },
    {
      name: "Pro",
      description: "For power users with larger knowledge needs",
      price: {
        monthly: 19,
        annually: 190,
      },
      features: [
        { text: "10 Projects", included: true },
        { text: "100MB document upload per project", included: true },
        { text: "Unlimited chat threads", included: true },
        { text: "Enhanced RAG processing", included: true },
        { text: "All Claude models access", included: true },
        { text: "Priority email support", included: true },
        {
          text: "Requires own Anthropic API key",
          tooltip: "You'll need to provide your own Anthropic API key",
          included: true,
        },
        { text: "Advanced document processing", included: true },
        { text: "Priority RAG indexing", included: true },
      ],
      buttonText: "Subscribe",
      buttonVariant: "default",
      highlighted: true,
    },
    {
      name: "Team",
      description: "For small teams collaborating on projects",
      price: {
        monthly: 49,
        annually: 490,
      },
      features: [
        { text: "25 Projects", included: true },
        { text: "250MB document upload per project", included: true },
        { text: "Unlimited chat threads", included: true },
        { text: "Premium RAG processing", included: true },
        { text: "All Claude models access", included: true },
        { text: "Dedicated support", included: true },
        {
          text: "Requires own Anthropic API key",
          tooltip: "You'll need to provide your own Anthropic API key",
          included: true,
        },
        { text: "Advanced document processing", included: true },
        { text: "Priority RAG indexing", included: true },
      ],
      buttonText: "Contact Sales",
      buttonVariant: "default",
    },
    {
      name: "Enterprise",
      description: "For organizations with advanced needs",
      price: {
        monthly: 199,
        annually: 1990,
      },
      features: [
        { text: "Unlimited Projects", included: true },
        { text: "1GB document upload per project", included: true },
        { text: "Unlimited chat threads", included: true },
        { text: "Enterprise RAG processing", included: true },
        { text: "All Claude models access", included: true },
        { text: "24/7 dedicated support", included: true },
        {
          text: "Requires own Anthropic API key",
          tooltip: "You'll need to provide your own Anthropic API key",
          included: true,
        },
        { text: "Advanced document processing", included: true },
        { text: "Priority RAG indexing", included: true },
      ],
      buttonText: "Contact Sales",
      buttonVariant: "default",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Pricing Plans</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect plan to unlock Claude's full potential with your documents
        </p>

        <div className="flex items-center justify-center mt-8 space-x-2">
          <span className={`text-sm ${billingCycle === "monthly" ? "font-medium" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <Switch
            checked={billingCycle === "annually"}
            onCheckedChange={(checked) => setBillingCycle(checked ? "annually" : "monthly")}
          />
          <span className={`text-sm ${billingCycle === "annually" ? "font-medium" : "text-muted-foreground"}`}>
            Annually <span className="text-claude-blue-600 font-medium">(Save 20%)</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col ${
              tier.highlighted
                ? "border-claude-blue-400 shadow-lg shadow-claude-blue-100 dark:shadow-claude-blue-900/20"
                : ""
            }`}
          >
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription className="min-h-[50px]">{tier.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">
                  ${billingCycle === "monthly" ? tier.price.monthly : tier.price.annually}
                </span>
                <span className="text-muted-foreground ml-1">/{billingCycle === "monthly" ? "month" : "year"}</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-2">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-claude-blue-500 mr-2 flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 mr-2" />
                    )}
                    <span
                      className={`text-sm ${
                        typeof feature.included === "boolean" && !feature.included ? "text-muted-foreground" : ""
                      }`}
                    >
                      {feature.text}
                    </span>
                    {feature.tooltip && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground ml-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{feature.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                variant={tier.buttonVariant}
                className={`w-full ${
                  tier.highlighted
                    ? "bg-claude-blue-500 hover:bg-claude-blue-600"
                    : tier.buttonVariant === "outline"
                      ? "border-claude-blue-300 text-claude-blue-700 hover:bg-claude-blue-50"
                      : ""
                }`}
              >
                <Link href={tier.name === "Free" ? "/signup" : "/contact"}>{tier.buttonText}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
