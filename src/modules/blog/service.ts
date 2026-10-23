import { MedusaService } from "@medusajs/framework/utils"
import BlogCategory from "./models/blog-category"
import BlogPost from "./models/blog-post"

class BlogModuleService extends MedusaService({
  BlogPost,
  BlogCategory,
}) {}

export default BlogModuleService
