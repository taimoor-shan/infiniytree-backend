# Blog photo credits

The featured photos of the blog posts imported by `src/scripts/seed-blog-posts.ts`.
All of them are from [Unsplash](https://unsplash.com) and free to use under the
[Unsplash License](https://unsplash.com/license): commercial use is allowed and no
attribution is required, but the photographers are credited here anyway.

They are cropped to 1600 × 1000 (16:10, the blog card's shape) and saved as JPEG.
The photos show real plants and interiors, not InfinYtree products, so each post's
alt text describes the photo itself.

| File | Post | Photo | Photographer |
|------|------|-------|--------------|
| `cherry-blossom-arrangement-lobby.jpg` | `artificial-cherry-blossom-tree-guide` | [Vase of pink blossoms in a modern, dimly lit interior](https://unsplash.com/photos/vase-of-pink-blossoms-in-a-modern-dimly-lit-interior-k2sOHAtJI58) | [N1CE](https://unsplash.com/@n1ce) |
| `white-phalaenopsis-orchid.jpg` | `orchids-that-look-real` | [Three white flowers in a vase on a table](https://unsplash.com/photos/three-white-flowers-in-a-vase-on-a-table-o1240roc_II) | [Earl Wilcox](https://unsplash.com/@earl_plannerzone) |
| `hotel-lobby-reception-plants.jpg` | `artificial-trees-for-hotels-and-restaurants` | [Modern lobby with marble reception desk and plants](https://unsplash.com/photos/modern-lobby-with-marble-reception-desk-and-plants-pt0nGH-NvoA) | [Aalo Lens](https://unsplash.com/@aalolens) |
| `dim-bathroom-with-plants.jpg` | `plants-for-dark-rooms` | [A bathroom with a plant and a bathtub](https://unsplash.com/photos/a-bathroom-with-a-plant-and-a-bathtub-w8FEsHwwL10) | [Vije Vijendranath](https://unsplash.com/@vijev) |
| `cleaning-potted-plants-cloth.jpg` | `how-to-clean-artificial-plants-and-trees` | [Woman wearing yellow gloves tending to potted plants](https://unsplash.com/photos/woman-wearing-yellow-gloves-tending-to-potted-plants-9omZ7q5KMtw) | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `office-reception-desk-tree.jpg` | `artificial-vs-real-plants-in-the-office` | [Minimalist interior featuring a wooden desk, plant, and window](https://unsplash.com/photos/minimalist-interior-featuring-a-wooden-desk-plant-and-window-VRoK8MxTlHY) | [Maverick Frame](https://unsplash.com/@maverickframe) |

To replace a photo, add the new file here under a new name, point the post's `image`
at it and run the import with `update`. The script compares file names: a post keeps
the copy it already shows as long as its `image` names the same file.
