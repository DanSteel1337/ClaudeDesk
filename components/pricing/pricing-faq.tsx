import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function PricingFAQ() {
  const faqs = [
    {
      question: "Why would I use ClaudeDesk instead of Claude.ai?",
      answer:
        "Claude.ai limits you to 200K tokens of Project Knowledge, which is roughly 150 pages of text. ClaudeDesk removes this limitation, allowing you to upload 100MB+ of documents per project. Additionally, ClaudeDesk organizes your work into separate projects, each with its own knowledge base and chat threads.",
    },
    {
      question: "Do I need my own Anthropic API key?",
      answer:
        "Yes, ClaudeDesk requires you to provide your own Anthropic API key. This gives you full control over your API usage and costs. Your key is securely encrypted and stored.",
    },
    {
      question: "How does the document processing work?",
      answer:
        "When you upload documents, ClaudeDesk processes them by extracting text, splitting it into chunks, generating embeddings, and storing them for retrieval. When you chat, relevant document chunks are retrieved and provided as context to Claude, enabling more accurate responses based on your documents.",
    },
    {
      question: "What file types are supported?",
      answer:
        "ClaudeDesk supports PDF, DOCX, TXT, and CSV files. We're continuously working to expand support for additional file formats.",
    },
    {
      question: "How is my data secured?",
      answer:
        "Your documents and conversations are securely stored and accessible only to you. We use encryption for sensitive data like API keys and implement row-level security to ensure data isolation between users.",
    },
    {
      question: "Can I upgrade or downgrade my plan?",
      answer:
        "Yes, you can change your subscription plan at any time. When upgrading, you'll have immediate access to the new features. When downgrading, the changes will take effect at the end of your current billing cycle.",
    },
    {
      question: "Is there a limit to how many documents I can upload?",
      answer:
        "Each plan has specific storage limits per project. The Free plan allows up to 10MB per project, Pro plan 100MB, Team plan 250MB, and Enterprise plan 1GB. These limits apply to each individual project you create.",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Frequently Asked Questions</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Everything you need to know about ClaudeDesk</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
