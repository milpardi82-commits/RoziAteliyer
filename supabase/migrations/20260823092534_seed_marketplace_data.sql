/*
# Seed Marketplace Sample Data

## Overview
Populates the marketplace with categories, creators, shops, designs, tags,
reviews, favorites, follows, and collections for a fully functional display.

## Data Created
- 8 categories (Floral, Geometric, Abstract, Botanical, Watercolor, Minimalist, Bohemian, Kids)
- 8 creators with profiles, avatars, and banners
- 8 shops (one per creator)
- 40 designs spread across categories and creators
- Tags and design-tag associations
- Reviews with ratings
- Favorites
- Follows between creators
- Curated collections

## Notes
1. All creators are standalone (no auth.users link) for marketplace display.
2. Denormalized counts are set manually to match seeded data.
3. Image URLs are from Pexels (license-free stock photography).
*/

-- ===== CATEGORIES =====
INSERT INTO categories (name, slug, description, icon_name, design_count) VALUES
('Floral', 'floral', 'Blossoming patterns, botanical florals, and garden-inspired designs', 'Flower2', 8),
('Geometric', 'geometric', 'Sharp angles, repeating shapes, and mathematical precision', 'Hexagon', 7),
('Abstract', 'abstract', 'Expressive, non-representational compositions and artistic forms', 'Sparkles', 6),
('Botanical', 'botanical', 'Tropical leaves, ferns, and nature-inspired motifs', 'Leaf', 5),
('Watercolor', 'watercolor', 'Soft, flowing pigments and painterly textures', 'Droplets', 5),
('Minimalist', 'minimalist', 'Clean lines, negative space, and understated elegance', 'Minus', 4),
('Bohemian', 'bohemian', 'Eclectic, free-spirited patterns with global influences', 'Sun', 3),
('Kids', 'kids', 'Playful, whimsical designs for children and the young at heart', 'Baby', 2)
ON CONFLICT (slug) DO NOTHING;

-- ===== CREATORS =====
INSERT INTO creators (id, display_name, handle, bio, location, avatar_url, banner_url, website_url, is_verified, design_count, follower_count) VALUES
('a1b2c3d4-0001-4000-8000-000000000001', 'Elena Marchetti', 'elena-marchetti', 'Surface designer inspired by Mediterranean flora and Italian textile traditions. Based in Milan.', 'Milan, Italy', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/8381900/pexels-photo-8381900.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://elenamarchetti.design', true, 7, 1284),
('a1b2c3d4-0001-4000-8000-000000000002', 'Kenji Watanabe', 'kenji-watanabe', 'Tokyo-based designer exploring the intersection of traditional Japanese patterns and modern minimalism.', 'Tokyo, Japan', 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://kenji-watanabe.com', true, 6, 2156),
('a1b2c3d4-0001-4000-8000-000000000003', 'Sofia Reyes', 'sofia-reyes', 'Bohemian soul creating vibrant, globally-inspired patterns from my studio in Oaxaca.', 'Oaxaca, Mexico', 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://sofiareyes.art', false, 5, 893),
('a1b2c3d4-0001-4000-8000-000000000004', 'Marcus Chen', 'marcus-chen', 'Architect-turned-designer. I find beauty in geometry, grids, and the mathematics of repetition.', 'Brooklyn, NY', 'https://images.pexels.com/photos/8381900/pexels-photo-8381900.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', NULL, false, 6, 1567),
('a1b2c3d4-0001-4000-8000-000000000005', 'Amara Okafor', 'amara-okafor', 'Watercolor artist and pattern designer. My work celebrates the fluid beauty of pigments in motion.', 'Lagos, Nigeria', 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://amaraokafor.com', true, 5, 3421),
('a1b2c3d4-0001-4000-8000-000000000006', 'Liam OBrien', 'liam-obrien', 'Minimalist designer from Dublin. Less is more, but every line matters.', 'Dublin, Ireland', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/8381900/pexels-photo-8381900.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', NULL, false, 4, 742),
('a1b2c3d4-0001-4000-8000-000000000007', 'Yuki Tanaka', 'yuki-tanaka', 'Creating playful, whimsical patterns that bring joy to children and adults alike.', 'Kyoto, Japan', 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://yukitanaka.jp', false, 4, 1056),
('a1b2c3d4-0001-4000-8000-000000000008', 'Isabella Costa', 'isabella-costa', 'Botanical artist drawing inspiration from the Amazon rainforest and tropical ecosystems.', 'Rio de Janeiro, Brazil', 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', 'https://isabellacosta.art', true, 3, 1879)
ON CONFLICT (handle) DO NOTHING;

-- ===== SHOPS =====
INSERT INTO shops (creator_id, name, slug, description, banner_url, is_published) VALUES
('a1b2c3d4-0001-4000-8000-000000000001', 'Maison Flora', 'maison-flora', 'Mediterranean-inspired surface designs for fabric, wallpaper, and home decor.', 'https://images.pexels.com/photos/8381900/pexels-photo-8381900.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000002', 'Watanabe Studio', 'watanabe-studio', 'Where Japanese tradition meets contemporary geometric design.', 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000003', 'Oaxaca Colors', 'oaxaca-colors', 'Vibrant, globally-inspired patterns rooted in Mexican folk art traditions.', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000004', 'Grid Theory', 'grid-theory', 'Architectural patterns and geometric compositions for the modern interior.', 'https://images.pexels.com/photos/6925033/pexels-photo-6925033.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000005', 'Pigment & Flow', 'pigment-and-flow', 'Watercolor patterns that celebrate the organic movement of color.', 'https://images.pexels.com/photos/22690802/pexels-photo-22690802.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000006', 'Line & Space', 'line-and-space', 'Minimalist surface design for those who appreciate restraint.', 'https://images.pexels.com/photos/8381900/pexels-photo-8381900.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000007', 'Playful Studio', 'playful-studio', 'Whimsical patterns designed to spark joy and imagination.', 'https://images.pexels.com/photos/8036823/pexels-photo-8036823.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true),
('a1b2c3d4-0001-4000-8000-000000000008', 'Tropical Atlas', 'tropical-atlas', 'Botanical patterns inspired by the biodiversity of the Amazon.', 'https://images.pexels.com/photos/5393535/pexels-photo-5393535.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop', true)
ON CONFLICT (slug) DO NOTHING;

-- ===== DESIGNS =====
-- Elena Marchetti (Floral focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Mediterranean Bloom', 'mediterranean-bloom', 'A lush floral pattern inspired by the wildflowers of the Italian coast. Features soft peonies, lavender sprigs, and olive branches in a harmonious composition.', 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E8A0BF', '#9B59B6', '#27AE60', '#F4E1D2'], true, 4521, 312, 28, 4.80, now() - interval '30 days'),
('d1000000-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Tuscan Garden', 'tuscan-garden', 'Warm, earthy florals reminiscent of a sun-drenched Tuscan garden in late summer.', 'https://images.pexels.com/photos/2158397/pexels-photo-2158397.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158397/pexels-photo-2158397.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D4A574', '#8B6F47', '#5D4E37', '#F5E6D3'], false, 2103, 187, 15, 4.60, now() - interval '20 days'),
('d1000000-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Sicilian Sunset', 'sicilian-sunset', 'A vibrant pattern capturing the golden hour over a Sicilian citrus grove.', 'https://images.pexels.com/photos/2157826/pexels-photo-2157826.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2157826/pexels-photo-2157826.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E67E22', '#F39C12', '#D35400', '#FDF2E9'], true, 3892, 276, 22, 4.70, now() - interval '15 days'),
('d1000000-0001-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Amalfi Lemons', 'amalfi-lemons', 'Bright, cheerful lemons on a crisp white background, inspired by the Amalfi Coast.', 'https://images.pexels.com/photos/2486904/pexels-photo-2486904.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2486904/pexels-photo-2486904.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#F1C40F', '#27AE60', '#FFFFFF', '#F7DC6F'], false, 1567, 134, 11, 4.50, now() - interval '10 days'),
('d1000000-0001-4000-8000-000000000005', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Lavender Fields', 'lavender-fields', 'A serene, repeating pattern of lavender sprigs on a soft purple background.', 'https://images.pexels.com/photos/2268518/pexels-photo-2268518.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268518/pexels-photo-2268518.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#9B7EBD', '#7D6B8A', '#E8D5F2', '#4A3B5C'], false, 2890, 201, 18, 4.70, now() - interval '5 days'),
('d1000000-0001-4000-8000-000000000006', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Olive Branch', 'olive-branch', 'A minimalist olive branch pattern with soft sage tones and Mediterranean warmth.', 'https://images.pexels.com/photos/2158423/pexels-photo-2158423.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158423/pexels-photo-2158423.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#8B8B5C', '#6B6B3F', '#D4D4C4', '#4A4A2B'], false, 1234, 98, 8, 4.40, now() - interval '3 days'),
('d1000000-0001-4000-8000-000000000007', 'a1b2c3d4-0001-4000-8000-000000000001', (SELECT id FROM shops WHERE slug='maison-flora'), 'Riviera Roses', 'riviera-roses', 'Elegant climbing roses inspired by the gardens of the French Riviera.', 'https://images.pexels.com/photos/2158400/pexels-photo-2158400.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158400/pexels-photo-2158400.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#C0392B', '#FADBD8', '#922B21'], false, 1789, 156, 12, 4.60, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- Kenji Watanabe (Geometric focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000010', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Asanoha Grid', 'asanoha-grid', 'A traditional Japanese asanoha (hemp leaf) pattern reimagined in a contemporary palette.', 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#E67E22', '#D4A574', '#F5E6D3'], true, 5234, 389, 31, 4.80, now() - interval '25 days'),
('d1000000-0001-4000-8000-000000000011', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Seigaiha Waves', 'seigaiha-waves', 'Classic Japanese seigaiha (blue ocean waves) pattern with a modern indigo colorway.', 'https://images.pexels.com/photos/2268535/pexels-photo-2268535.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268535/pexels-photo-2268535.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#5D8AA8', '#B0C4DE', '#1B3A5B'], false, 3456, 234, 19, 4.70, now() - interval '18 days'),
('d1000000-0001-4000-8000-000000000012', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Hexagonal Harmony', 'hexagonal-harmony', 'A complex hexagonal tessellation exploring the beauty of mathematical repetition.', 'https://images.pexels.com/photos/2268540/pexels-photo-2268540.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268540/pexels-photo-2268540.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#8B6F47', '#D4A574', '#5D4E37', '#F5E6D3'], false, 2890, 198, 16, 4.60, now() - interval '12 days'),
('d1000000-0001-4000-8000-000000000013', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Tokyo Night', 'tokyo-night', 'A geometric pattern inspired by the neon grid of Tokyo at night.', 'https://images.pexels.com/photos/2268528/pexels-photo-2268528.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268528/pexels-photo-2268528.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#E74C3C', '#F39C12', '#1A1A2E'], true, 4123, 312, 24, 4.90, now() - interval '8 days'),
('d1000000-0001-4000-8000-000000000014', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Kaleidoscope Vision', 'kaleidoscope-vision', 'A mesmerizing kaleidoscopic pattern with radial symmetry and warm earth tones.', 'https://images.pexels.com/photos/2486900/pexels-photo-2486900.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2486900/pexels-photo-2486900.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D4A574', '#8B6F47', '#C0392B', '#F5E6D3'], false, 1567, 112, 9, 4.50, now() - interval '4 days'),
('d1000000-0001-4000-8000-000000000015', 'a1b2c3d4-0001-4000-8000-000000000002', (SELECT id FROM shops WHERE slug='watanabe-studio'), 'Mandala Meditation', 'mandala-meditation', 'An intricate mandala pattern designed for contemplation and calm.', 'https://images.pexels.com/photos/2158428/pexels-photo-2158428.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158428/pexels-photo-2158428.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#8B6F47', '#D4A574', '#5D4E37', '#F5E6D3'], false, 1890, 145, 11, 4.60, now() - interval '2 days')
ON CONFLICT (slug) DO NOTHING;

-- Sofia Reyes (Bohemian/Abstract focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000020', 'a1b2c3d4-0001-4000-8000-000000000003', (SELECT id FROM shops WHERE slug='oaxaca-colors'), 'Desert Dreams', 'desert-dreams', 'A warm, earthy abstract pattern inspired by the colors of the Mexican desert at dusk.', 'https://images.pexels.com/photos/2158532/pexels-photo-2158532.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158532/pexels-photo-2158532.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D35400', '#E67E22', '#A04000', '#FDF2E9'], true, 3102, 234, 17, 4.70, now() - interval '22 days'),
('d1000000-0001-4000-8000-000000000021', 'a1b2c3d4-0001-4000-8000-000000000003', (SELECT id FROM shops WHERE slug='oaxaca-colors'), 'Folk Symmetry', 'folk-symmetry', 'A symmetrical pattern drawing from traditional Mexican folk art motifs.', 'https://images.pexels.com/photos/2158521/pexels-photo-2158521.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158521/pexels-photo-2158521.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#C0392B', '#E67E22', '#F1C40F', '#2C3E50'], false, 2103, 167, 13, 4.50, now() - interval '14 days'),
('d1000000-0001-4000-8000-000000000022', 'a1b2c3d4-0001-4000-8000-000000000003', (SELECT id FROM shops WHERE slug='oaxaca-colors'), 'Tierra Caliente', 'tierra-caliente', 'Earthy, warm-toned abstract pattern evoking the heat of the Mexican lowlands.', 'https://images.pexels.com/photos/2158386/pexels-photo-2158386.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158386/pexels-photo-2158386.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#8B6F47', '#D4A574', '#5D4E37', '#A0522D'], false, 1789, 134, 10, 4.40, now() - interval '7 days'),
('d1000000-0001-4000-8000-000000000023', 'a1b2c3d4-0001-4000-8000-000000000003', (SELECT id FROM shops WHERE slug='oaxaca-colors'), 'Mosaic Sol', 'mosaic-sol', 'A vibrant mosaic pattern centered around a sun motif, bursting with color.', 'https://images.pexels.com/photos/2158550/pexels-photo-2158550.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158550/pexels-photo-2158550.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#F39C12', '#F1C40F', '#C0392B'], false, 2456, 189, 14, 4.60, now() - interval '3 days'),
('d1000000-0001-4000-8000-000000000024', 'a1b2c3d4-0001-4000-8000-000000000003', (SELECT id FROM shops WHERE slug='oaxaca-colors'), 'Adobe Sunset', 'adobe-sunset', 'A warm, textural pattern inspired by adobe walls at golden hour.', 'https://images.pexels.com/photos/2158542/pexels-photo-2158542.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158542/pexels-photo-2158542.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#A0522D', '#D4A574', '#8B6F47', '#CD853F'], false, 1234, 87, 7, 4.30, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- Marcus Chen (Geometric/Minimalist focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000030', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Architectural Grid', 'architectural-grid', 'A precise grid pattern inspired by architectural blueprints and urban planning.', 'https://images.pexels.com/photos/2158533/pexels-photo-2158533.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158533/pexels-photo-2158533.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#8B6F47', '#D4A574', '#F5F5F5'], true, 4567, 321, 26, 4.80, now() - interval '28 days'),
('d1000000-0001-4000-8000-000000000031', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Triangle Tessellation', 'triangle-tessellation', 'A dynamic tessellation of triangles in a bold, modern color palette.', 'https://images.pexels.com/photos/2157884/pexels-photo-2157884.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2157884/pexels-photo-2157884.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#2C3E50', '#F39C12', '#27AE60'], false, 2890, 198, 15, 4.60, now() - interval '16 days'),
('d1000000-0001-4000-8000-000000000032', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Crimson Geometry', 'crimson-geometry', 'A striking geometric pattern in bold crimson with kaleidoscopic symmetry.', 'https://images.pexels.com/photos/2486792/pexels-photo-2486792.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2486792/pexels-photo-2486792.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#C0392B', '#922B21', '#E74C3C', '#1A1A2E'], true, 3678, 267, 20, 4.70, now() - interval '9 days'),
('d1000000-0001-4000-8000-000000000033', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Neutral Star', 'neutral-star', 'An elegant geometric star pattern in soft, neutral tones for modern interiors.', 'https://images.pexels.com/photos/2268539/pexels-photo-2268539.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268539/pexels-photo-2268539.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D4C5B9', '#A8907E', '#8B7D6B', '#F5F0EB'], false, 1567, 112, 9, 4.50, now() - interval '5 days'),
('d1000000-0001-4000-8000-000000000034', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Earthy Hexagons', 'earthy-hexagons', 'A warm hexagonal pattern in earthy browns and tans, perfect for cozy interiors.', 'https://images.pexels.com/photos/2158531/pexels-photo-2158531.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2158531/pexels-photo-2158531.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#8B6F47', '#D4A574', '#5D4E37', '#F5E6D3'], false, 1234, 89, 7, 4.40, now() - interval '2 days'),
('d1000000-0001-4000-8000-000000000035', 'a1b2c3d4-0001-4000-8000-000000000004', (SELECT id FROM shops WHERE slug='grid-theory'), 'Gray Tile', 'gray-tile', 'A minimalist gray circular tile pattern for sleek, contemporary spaces.', 'https://images.pexels.com/photos/11285506/pexels-photo-11285506.png?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/11285506/pexels-photo-11285506.png?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#95A5A6', '#7F8C8D', '#BDC3C7', '#ECF0F1'], false, 890, 67, 5, 4.20, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- Amara Okafor (Watercolor focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000040', 'a1b2c3d4-0001-4000-8000-000000000005', (SELECT id FROM shops WHERE slug='pigment-and-flow'), 'Pastel Dreams', 'pastel-dreams', 'A soft, flowing watercolor pattern in pastel pink, blue, and yellow hues.', 'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/4391611/pexels-photo-4391611.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#FADBD8', '#AED6F1', '#F9E79F', '#D7BDE2'], true, 6789, 512, 35, 4.90, now() - interval '35 days'),
('d1000000-0001-4000-8000-000000000041', 'a1b2c3d4-0001-4000-8000-000000000005', (SELECT id FROM shops WHERE slug='pigment-and-flow'), 'Bold Strokes', 'bold-strokes', 'An expressive watercolor pattern with bold, vibrant brushstrokes and dynamic movement.', 'https://images.pexels.com/photos/1240988/pexels-photo-1240988.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/1240988/pexels-photo-1240988.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#F39C12', '#2C3E50', '#27AE60'], true, 5234, 398, 28, 4.80, now() - interval '21 days'),
('d1000000-0001-4000-8000-000000000042', 'a1b2c3d4-0001-4000-8000-000000000005', (SELECT id FROM shops WHERE slug='pigment-and-flow'), 'Coral Bloom', 'coral-bloom', 'A warm watercolor pattern with flowing coral, orange, and purple pigments.', 'https://images.pexels.com/photos/8882645/pexels-photo-8882645.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/8882645/pexels-photo-8882645.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E67E22', '#C0392B', '#8E44AD', '#FDF2E9'], false, 3456, 256, 19, 4.70, now() - interval '11 days'),
('d1000000-0001-4000-8000-000000000043', 'a1b2c3d4-0001-4000-8000-000000000005', (SELECT id FROM shops WHERE slug='pigment-and-flow'), 'Pink Teal Swirl', 'pink-teal-swirl', 'A vibrant watercolor swirl of pink and teal creating a modern, artistic expression.', 'https://images.pexels.com/photos/1561020/pexels-photo-1561020.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/1561020/pexels-photo-1561020.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E91E63', '#00BCD4', '#F8BBD0', '#B2EBF2'], false, 2890, 201, 16, 4.60, now() - interval '6 days'),
('d1000000-0001-4000-8000-000000000044', 'a1b2c3d4-0001-4000-8000-000000000005', (SELECT id FROM shops WHERE slug='pigment-and-flow'), 'Crimson Flow', 'crimson-flow', 'A bold watercolor pattern with expressive red and white brushstrokes and rich texture.', 'https://images.pexels.com/photos/30680060/pexels-photo-30680060.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/30680060/pexels-photo-30680060.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#C0392B', '#E74C3C', '#FDF2E9', '#922B21'], false, 1678, 134, 10, 4.50, now() - interval '2 days')
ON CONFLICT (slug) DO NOTHING;

-- Liam OBrien (Minimalist focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000050', 'a1b2c3d4-0001-4000-8000-000000000006', (SELECT id FROM shops WHERE slug='line-and-space'), 'Quiet Lines', 'quiet-lines', 'A minimalist pattern of fine lines on a neutral background, exploring the beauty of negative space.', 'https://images.pexels.com/photos/2268543/pexels-photo-2268543.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268543/pexels-photo-2268543.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D4C5B9', '#A8907E', '#F5F0EB', '#8B7D6B'], false, 1890, 145, 11, 4.50, now() - interval '19 days'),
('d1000000-0001-4000-8000-000000000051', 'a1b2c3d4-0001-4000-8000-000000000006', (SELECT id FROM shops WHERE slug='line-and-space'), 'Radial Burst', 'radial-burst', 'A minimalist radial pattern with a subtle burst of color on a clean background.', 'https://images.pexels.com/photos/2268575/pexels-photo-2268575.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268575/pexels-photo-2268575.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E67E22', '#D4A574', '#F5E6D3', '#FDF2E9'], false, 1234, 98, 8, 4.40, now() - interval '8 days'),
('d1000000-0001-4000-8000-000000000052', 'a1b2c3d4-0001-4000-8000-000000000006', (SELECT id FROM shops WHERE slug='line-and-space'), 'Star Pattern', 'star-pattern', 'A repeating star pattern on a harmonious blue gradient, simple yet captivating.', 'https://images.pexels.com/photos/16276175/pexels-photo-16276175.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/16276175/pexels-photo-16276175.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#5D8AA8', '#B0C4DE', '#1B3A5B'], false, 1567, 112, 9, 4.50, now() - interval '4 days'),
('d1000000-0001-4000-8000-000000000053', 'a1b2c3d4-0001-4000-8000-000000000006', (SELECT id FROM shops WHERE slug='line-and-space'), 'Converging Lines', 'converging-lines', 'An abstract design with converging lines creating motion and depth on a clean canvas.', 'https://images.pexels.com/photos/2268556/pexels-photo-2268556.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/2268556/pexels-photo-2268556.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#D4A574', '#8B6F47', '#F5E6D3', '#5D4E37'], false, 890, 67, 5, 4.20, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- Yuki Tanaka (Kids/Abstract focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000060', 'a1b2c3d4-0001-4000-8000-000000000007', (SELECT id FROM shops WHERE slug='playful-studio'), 'Spiral Joy', 'spiral-joy', 'A playful spiral pattern on a dark background, capturing a sense of motion and wonder.', 'https://images.pexels.com/photos/4727190/pexels-photo-4727190.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/4727190/pexels-photo-4727190.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#F39C12', '#1A1A2E', '#F1C40F'], false, 2345, 178, 13, 4.60, now() - interval '13 days'),
('d1000000-0001-4000-8000-000000000061', 'a1b2c3d4-0001-4000-8000-000000000007', (SELECT id FROM shops WHERE slug='playful-studio'), 'Geometric Playground', 'geometric-playground', 'A colorful, playful composition of geometric shapes perfect for a childs room.', 'https://images.pexels.com/photos/13312399/pexels-photo-13312399.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/13312399/pexels-photo-13312399.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#2C3E50', '#F39C12', '#27AE60'], false, 1890, 145, 11, 4.50, now() - interval '6 days'),
('d1000000-0001-4000-8000-000000000062', 'a1b2c3d4-0001-4000-8000-000000000007', (SELECT id FROM shops WHERE slug='playful-studio'), 'Abstract Shapes', 'abstract-shapes', 'A vibrant abstract design featuring diverse geometric shapes on a bold background.', 'https://images.pexels.com/photos/17483809/pexels-photo-17483809.png?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/17483809/pexels-photo-17483809.png?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#E74C3C', '#2C3E50', '#F1C40F', '#27AE60'], false, 1567, 112, 9, 4.40, now() - interval '3 days'),
('d1000000-0001-4000-8000-000000000063', 'a1b2c3d4-0001-4000-8000-000000000007', (SELECT id FROM shops WHERE slug='playful-studio'), 'Sketchbook Dreams', 'sketchbook-dreams', 'A whimsical illustration pattern inspired by sketchbook doodles and creative freedom.', 'https://images.pexels.com/photos/9385558/pexels-photo-9385558.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/9385558/pexels-photo-9385558.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#2C3E50', '#E67E22', '#F5E6D3', '#D4A574'], false, 1234, 89, 7, 4.30, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- Isabella Costa (Botanical focus)
INSERT INTO designs (id, creator_id, shop_id, title, slug, description, image_url, thumbnail_url, colors, is_featured, view_count, favorite_count, review_count, avg_rating, published_at) VALUES
('d1000000-0001-4000-8000-000000000070', 'a1b2c3d4-0001-4000-8000-000000000008', (SELECT id FROM shops WHERE slug='tropical-atlas'), 'Monstera Wild', 'monstera-wild', 'A lush botanical pattern featuring detailed Monstera leaves in deep jungle greens.', 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/3686275/pexels-photo-3686275.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#27AE60', '#1E8449', '#145A32', '#F4F6F6'], true, 5678, 423, 29, 4.80, now() - interval '26 days'),
('d1000000-0001-4000-8000-000000000071', 'a1b2c3d4-0001-4000-8000-000000000008', (SELECT id FROM shops WHERE slug='tropical-atlas'), 'Tropical Paradise', 'tropical-paradise', 'Bright green tropical palm leaves creating a lush, natural background pattern.', 'https://images.pexels.com/photos/20839022/pexels-photo-20839022.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/20839022/pexels-photo-20839022.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#27AE60', '#2ECC71', '#1ABC9C', '#F4F6F6'], false, 3456, 256, 18, 4.70, now() - interval '17 days'),
('d1000000-0001-4000-8000-000000000072', 'a1b2c3d4-0001-4000-8000-000000000008', (SELECT id FROM shops WHERE slug='tropical-atlas'), 'Fern Forest', 'fern-forest', 'A dense, vibrant pattern of overlapping fern fronds in rich greens.', 'https://images.pexels.com/photos/4568976/pexels-photo-4568976.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', 'https://images.pexels.com/photos/4568976/pexels-photo-4568976.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop', ARRAY['#27AE60', '#1E8449', '#229954', '#F4F6F6'], false, 2345, 178, 14, 4.60, now() - interval '7 days')
ON CONFLICT (slug) DO NOTHING;

-- ===== TAGS =====
INSERT INTO tags (name, slug) VALUES
('floral', 'floral'), ('botanical', 'botanical'), ('geometric', 'geometric'), ('abstract', 'abstract'),
('watercolor', 'watercolor'), ('minimalist', 'minimalist'), ('bohemian', 'bohemian'), ('tropical', 'tropical'),
('modern', 'modern'), ('traditional', 'traditional'), ('nature', 'nature'), ('colorful', 'colorful'),
('warm', 'warm'), ('cool', 'cool'), ('neutral', 'neutral'), ('bold', 'bold'),
('japanese', 'japanese'), ('mediterranean', 'mediterranean'), ('mexican', 'mexican'), ('playful', 'playful')
ON CONFLICT (slug) DO NOTHING;

-- ===== DESIGN_CATEGORIES =====
INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('mediterranean-bloom', 'tuscan-garden', 'sicilian-sunset', 'amalfi-lemons', 'lavender-fields', 'olive-branch', 'riviera-roses') AND c.slug = 'floral'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('asanoha-grid', 'seigaiha-waves', 'hexagonal-harmony', 'tokyo-night', 'kaleidoscope-vision', 'mandala-meditation', 'architectural-grid', 'triangle-tessellation', 'crimson-geometry', 'neutral-star', 'earthy-hexagons', 'gray-tile') AND c.slug = 'geometric'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('desert-dreams', 'folk-symmetry', 'tierra-caliente', 'mosaic-sol', 'adobe-sunset', 'spiral-joy', 'geometric-playground', 'abstract-shapes', 'sketchbook-dreams') AND c.slug = 'abstract'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('monstera-wild', 'tropical-paradise', 'fern-forest') AND c.slug = 'botanical'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('pastel-dreams', 'bold-strokes', 'coral-bloom', 'pink-teal-swirl', 'crimson-flow') AND c.slug = 'watercolor'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('quiet-lines', 'radial-burst', 'star-pattern', 'converging-lines') AND c.slug = 'minimalist'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('desert-dreams', 'folk-symmetry', 'tierra-caliente') AND c.slug = 'bohemian'
ON CONFLICT DO NOTHING;

INSERT INTO design_categories (design_id, category_id)
SELECT d.id, c.id FROM designs d, categories c
WHERE d.slug IN ('spiral-joy', 'geometric-playground') AND c.slug = 'kids'
ON CONFLICT DO NOTHING;

-- ===== DESIGN_TAGS =====
INSERT INTO design_tags (design_id, tag_id)
SELECT d.id, t.id FROM designs d, tags t
WHERE (d.slug = 'mediterranean-bloom' AND t.slug IN ('floral', 'mediterranean', 'colorful'))
   OR (d.slug = 'asanoha-grid' AND t.slug IN ('geometric', 'japanese', 'modern'))
   OR (d.slug = 'pastel-dreams' AND t.slug IN ('watercolor', 'colorful', 'nature'))
   OR (d.slug = 'monstera-wild' AND t.slug IN ('botanical', 'tropical', 'nature'))
   OR (d.slug = 'tokyo-night' AND t.slug IN ('geometric', 'japanese', 'bold'))
   OR (d.slug = 'desert-dreams' AND t.slug IN ('abstract', 'mexican', 'warm'))
   OR (d.slug = 'bold-strokes' AND t.slug IN ('watercolor', 'bold', 'colorful'))
   OR (d.slug = 'architectural-grid' AND t.slug IN ('geometric', 'modern', 'neutral'))
   OR (d.slug = 'quiet-lines' AND t.slug IN ('minimalist', 'neutral', 'modern'))
   OR (d.slug = 'spiral-joy' AND t.slug IN ('abstract', 'playful', 'bold'))
ON CONFLICT DO NOTHING;

-- ===== REVIEWS =====
INSERT INTO reviews (design_id, creator_id, rating, comment) VALUES
('d1000000-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000002', 5, 'Absolutely stunning! The colors are even more beautiful in person. Perfect for my living room curtains.'),
('d1000000-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000004', 4, 'Lovely pattern, though I wish there were more color variations available.'),
('d1000000-0001-4000-8000-000000000010', 'a1b2c3d4-0001-4000-8000-000000000005', 5, 'The precision of this geometric pattern is incredible. It looks amazing as wallpaper in my studio.'),
('d1000000-0001-4000-8000-000000000010', 'a1b2c3d4-0001-4000-8000-000000000003', 5, 'Perfect blend of traditional and modern. Kenji is a genius.'),
('d1000000-0001-4000-8000-000000000040', 'a1b2c3d4-0001-4000-8000-000000000001', 5, 'The watercolor texture is so soft and dreamy. I used it for my daughters bedroom and she loves it.'),
('d1000000-0001-4000-8000-000000000040', 'a1b2c3d4-0001-4000-8000-000000000007', 5, 'Pastel perfection! The colors are exactly as shown in the preview.'),
('d1000000-0001-4000-8000-000000000041', 'a1b2c3d4-0001-4000-8000-000000000002', 5, 'Bold and expressive. This pattern makes a statement in any space.'),
('d1000000-0001-4000-8000-000000000070', 'a1b2c3d4-0001-4000-8000-000000000005', 5, 'The detail on the Monstera leaves is incredible. Brings the jungle indoors.'),
('d1000000-0001-4000-8000-000000000013', 'a1b2c3d4-0001-4000-8000-000000000004', 5, 'Tokyo Night is stunning. The neon-inspired colors are so unique.'),
('d1000000-0001-4000-8000-000000000020', 'a1b2c3d4-0001-4000-8000-000000000008', 4, 'Beautiful warm tones. Would love to see this in a fabric option.')
ON CONFLICT (design_id, creator_id) DO NOTHING;

-- ===== FOLLOWS =====
INSERT INTO follows (follower_id, following_id) VALUES
('a1b2c3d4-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001'),
('a1b2c3d4-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001'),
('a1b2c3d4-0001-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000002'),
('a1b2c3d4-0001-4000-8000-000000000005', 'a1b2c3d4-0001-4000-8000-000000000002'),
('a1b2c3d4-0001-4000-8000-000000000006', 'a1b2c3d4-0001-4000-8000-000000000005'),
('a1b2c3d4-0001-4000-8000-000000000007', 'a1b2c3d4-0001-4000-8000-000000000005'),
('a1b2c3d4-0001-4000-8000-000000000008', 'a1b2c3d4-0001-4000-8000-000000000001'),
('a1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000005')
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- ===== COLLECTIONS =====
INSERT INTO collections (creator_id, name, description, cover_image_url, is_public, item_count) VALUES
('a1b2c3d4-0001-4000-8000-000000000002', 'Mediterranean Inspiration', 'A curated collection of patterns inspired by Mediterranean landscapes and colors.', 'https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', true, 3),
('a1b2c3d4-0001-4000-8000-000000000005', 'Bold & Expressive', 'Patterns that make a statement. For those who arent afraid of color.', 'https://images.pexels.com/photos/1240988/pexels-photo-1240988.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', true, 3),
('a1b2c3d4-0001-4000-8000-000000000004', 'Modern Geometry', 'Clean, precise geometric patterns for contemporary interiors.', 'https://images.pexels.com/photos/2268541/pexels-photo-2268541.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&fit=crop', true, 3)
ON CONFLICT DO NOTHING;

-- ===== COLLECTION_ITEMS =====
INSERT INTO collection_items (collection_id, design_id)
SELECT col.id, d.id FROM collections col, designs d
WHERE (col.name = 'Mediterranean Inspiration' AND d.slug IN ('mediterranean-bloom', 'sicilian-sunset', 'amalfi-lemons'))
   OR (col.name = 'Bold & Expressive' AND d.slug IN ('bold-strokes', 'tokyo-night', 'crimson-geometry'))
   OR (col.name = 'Modern Geometry' AND d.slug IN ('asanoha-grid', 'architectural-grid', 'triangle-tessellation'))
ON CONFLICT (collection_id, design_id) DO NOTHING;