import { Check, X } from "lucide-react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ComparisonTable() {
  const features = [
    {
      name: "Document Upload Limit",
      claudeAi: "200K tokens (~150 pages)",
      claudeDesk: "10MB-1GB per project (plan dependent)",
    },
    {
      name: "Project Organization",
      claudeAi: <X className="h-5 w-5 text-red-500 mx-auto" />,
      claudeDesk: <Check className="h-5 w-5 text-claude-blue-500 mx-auto" />,
    },
    {
      name: "Multiple Knowledge Bases",
      claudeAi: <X className="h-5 w-5 text-red-500 mx-auto" />,
      claudeDesk: <Check className="h-5 w-5 text-claude-blue-500 mx-auto" />,
    },
    {
      name: "Semantic Search",
      claudeAi: "Limited",
      claudeDesk: "Advanced",
    },
    {
      name: "API Key Required",
      claudeAi: <X className="h-5 w-5 text-red-500 mx-auto" />,
      claudeDesk: <Check className="h-5 w-5 text-claude-blue-500 mx-auto" />,
    },
    {
      name: "Daily Usage Limits",
      claudeAi: "Yes (fixed)",
      claudeDesk: "Based on your API key",
    },
    {
      name: "Document Persistence",
      claudeAi: "Limited time",
      claudeDesk: "Permanent",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">ClaudeDesk vs Claude.ai</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          See how ClaudeDesk compares to the standard Claude.ai experience
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableCaption>A comparison of features between ClaudeDesk and Claude.ai</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Feature</TableHead>
              <TableHead className="text-center">Claude.ai</TableHead>
              <TableHead className="text-center">ClaudeDesk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature) => (
              <TableRow key={feature.name}>
                <TableCell className="font-medium">{feature.name}</TableCell>
                <TableCell className="text-center">{feature.claudeAi}</TableCell>
                <TableCell className="text-center">{feature.claudeDesk}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
