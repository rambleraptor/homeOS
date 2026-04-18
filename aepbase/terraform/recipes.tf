# Recipes and the cooking log that tracks attempts.

resource "aep_aep-resource-definition" "recipe" {
  singular             = "recipe"
  plural               = "recipes"
  description          = "A culinary recipe with parsed ingredients for scaling."
  user_settable_create = true
  schema = jsonencode({
    type = "object"
    properties = {
      title          = { type = "string", description = "Display name of the recipe." }
      source_type    = { type = "string", description = "Origin category for source_pointer. One of: manual, text, url, book." }
      source_pointer = { type = "string", description = "URI or physical reference (e.g. 'https://...' or 'Book: Food Lab pg 124')." }
      version        = { type = "number", description = "Monotonically increasing revision counter; starts at 1 and bumps on each edit." }
      parsed_ingredients = {
        type        = "array"
        description = "Structured ingredient list separated from quantities for scaling."
        items = {
          type = "object"
          properties = {
            item = { type = "string", description = "Normalized ingredient name." }
            qty  = { type = "number", description = "Numerical quantity (decimal for fractions)." }
            unit = { type = "string", description = "Standardized unit (cup, tsp, g, whole, ...)." }
            raw  = { type = "string", description = "Original unparsed ingredient string." }
          }
        }
      }
      method = { type = "string", description = "Step-by-step instructions formatted as Markdown." }
      tags = {
        type        = "array"
        items       = { type = "string" }
        description = "Categorical tags for filtering and menu generation."
      }
      created_by = { type = "string", description = "users/{user_id}" }
    }
    required = ["title", "parsed_ingredients", "source_type", "version"]
  })
}

resource "aep_aep-resource-definition" "log" {
  singular             = "log"
  plural               = "logs"
  description          = "A single cooking attempt of a recipe with outcome and notes."
  user_settable_create = true
  parents              = ["recipe"]
  depends_on           = [aep_aep-resource-definition.recipe]
  schema = jsonencode({
    type = "object"
    properties = {
      date            = { type = "string", format = "date-time" }
      notes           = { type = "string" }
      success         = { type = "boolean" }
      rating          = { type = "number", description = "1-5 scale" }
      deviated        = { type = "boolean" }
      deviation_notes = { type = "string" }
      created_by      = { type = "string" }
    }
    required = ["date"]
  })
}
