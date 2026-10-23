import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import { Container, Heading, Tabs } from "@medusajs/ui"
import CategoriesPanel from "../../components/blog/categories-panel"
import PostsPanel from "../../components/blog/posts-panel"

type Tab = "posts" | "categories"

const BlogRoute = () => {
  const [tab, setTab] = useState<Tab>("posts")

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Blog</Heading>
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <Tabs.List>
            <Tabs.Trigger value="posts">Posts</Tabs.Trigger>
            <Tabs.Trigger value="categories">Categories</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>
      {tab === "posts" ? <PostsPanel /> : <CategoriesPanel />}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Blog",
  icon: DocumentText,
})

export default BlogRoute
