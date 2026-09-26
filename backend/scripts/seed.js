const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERREUR: Le seed est formellement interdit en environnement de PRODUCTION.');
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed de la base de données MandeMarket...\n');
  // Les comptes documentés de démonstration doivent être immédiatement
  // utilisables. La vérification reste obligatoire pour toute inscription réelle.
  const seedVerifiedAt = new Date();

  // ===== CATÉGORIES =====
  console.log('📁 Création des catégories...');

  // --- Catégories racines ---
  const electronique = await db.category.upsert({
    where: { slug: 'electronique' },
    update: {},
    create: {
      name: 'Électronique & High-Tech',
      slug: 'electronique',
      description: 'Smartphones, ordinateurs, TV, audio et accessoires tech',
      status: 'active',
      displayOrder: 1
    }
  });
  console.log(`  ✅ Catégorie: ${electronique.name}`);

  const modeAccessoires = await db.category.upsert({
    where: { slug: 'mode-accessoires' },
    update: {},
    create: {
      name: 'Mode & Accessoires',
      slug: 'mode-accessoires',
      description: 'Vêtements, chaussures, sacs et bijoux pour femme, homme et enfant',
      status: 'active',
      displayOrder: 2
    }
  });
  console.log(`  ✅ Catégorie: ${modeAccessoires.name}`);

  const alimentation = await db.category.upsert({
    where: { slug: 'alimentation' },
    update: {},
    create: {
      name: 'Alimentation & Gastronomie',
      slug: 'alimentation',
      description: 'Épicerie, boissons, spécialités africaines et produits frais',
      status: 'active',
      displayOrder: 3
    }
  });
  console.log(`  ✅ Catégorie: ${alimentation.name}`);

  const beauteSante = await db.category.upsert({
    where: { slug: 'beaute-sante' },
    update: {},
    create: {
      name: 'Beauté & Santé',
      slug: 'beaute-sante',
      description: 'Cosmétiques, soins du corps, parfums et produits de santé',
      status: 'active',
      displayOrder: 4
    }
  });
  console.log(`  ✅ Catégorie: ${beauteSante.name}`);

  const maisonDecoration = await db.category.upsert({
    where: { slug: 'maison-decoration' },
    update: {},
    create: {
      name: 'Maison & Décoration',
      slug: 'maison-decoration',
      description: 'Mobilier, décoration, électroménager et articles de maison',
      status: 'active',
      displayOrder: 5
    }
  });
  console.log(`  ✅ Catégorie: ${maisonDecoration.name}`);

  const sportLoisirs = await db.category.upsert({
    where: { slug: 'sport-loisirs' },
    update: {},
    create: {
      name: 'Sport & Loisirs',
      slug: 'sport-loisirs',
      description: 'Équipements sportifs, jeux, jouets et articles de loisir',
      status: 'active',
      displayOrder: 6
    }
  });
  console.log(`  ✅ Catégorie: ${sportLoisirs.name}`);

  const artisanatExotique = await db.category.upsert({
    where: { slug: 'artisanat-exotique' },
    update: {},
    create: {
      name: 'Artisanat & Produits Exotiques',
      slug: 'artisanat-exotique',
      description: 'Artisanat africain, épices rares, produits naturels et objets d\'art',
      status: 'active',
      displayOrder: 7
    }
  });
  console.log(`  ✅ Catégorie: ${artisanatExotique.name}`);

  const services = await db.category.upsert({
    where: { slug: 'services' },
    update: {},
    create: {
      name: 'Services',
      slug: 'services',
      description: 'Cours, formations, réparations et prestations diverses',
      status: 'active',
      displayOrder: 8
    }
  });
  console.log(`  ✅ Catégorie: ${services.name}`);

  // --- Sous-catégories : electronique ---
  const smartphonesCat = await db.category.upsert({
    where: { slug: 'smartphones-tablettes' },
    update: {},
    create: {
      name: 'Smartphones & Tablettes',
      slug: 'smartphones-tablettes',
      description: 'Téléphones, tablettes et accessoires',
      status: 'active',
      parentId: electronique.id,
      displayOrder: 1
    }
  });
  console.log(`  ✅ Catégorie: ${smartphonesCat.name}`);

  const informatiqueOrElectroCat = await db.category.upsert({
    where: { slug: 'informatique' },
    update: {},
    create: {
      name: 'Informatique',
      slug: 'informatique',
      description: 'Ordinateurs, laptops, composants et périphériques',
      status: 'active',
      parentId: electronique.id,
      displayOrder: 2
    }
  });
  console.log(`  ✅ Catégorie: ${informatiqueOrElectroCat.name}`);

  const tvAudio = await db.category.upsert({
    where: { slug: 'tv-audio' },
    update: {},
    create: {
      name: 'TV & Audio',
      slug: 'tv-audio',
      description: 'Télévisions, enceintes, casques et home cinéma',
      status: 'active',
      parentId: electronique.id,
      displayOrder: 3
    }
  });
  console.log(`  ✅ Catégorie: ${tvAudio.name}`);

  // --- Sous-catégories : mode-accessoires ---
  const sacsCat = await db.category.upsert({
    where: { slug: 'sacs-maroquinerie' },
    update: {},
    create: {
      name: 'Sacs & Maroquinerie',
      slug: 'sacs-maroquinerie',
      description: 'Sacs à main, sacs de voyage, portefeuilles et accessoires cuir',
      status: 'active',
      parentId: modeAccessoires.id,
      displayOrder: 1
    }
  });
  console.log(`  ✅ Catégorie: ${sacsCat.name}`);

  const vêtementsCat = await db.category.upsert({
    where: { slug: 'vetements' },
    update: {},
    create: {
      name: 'Vêtements',
      slug: 'vetements',
      description: 'Robes, chemises, pantalons, boubous et tenues traditionnelles',
      status: 'active',
      parentId: modeAccessoires.id,
      displayOrder: 2
    }
  });
  console.log(`  ✅ Catégorie: ${vêtementsCat.name}`);

  const chaussures = await db.category.upsert({
    where: { slug: 'chaussures' },
    update: {},
    create: {
      name: 'Chaussures',
      slug: 'chaussures',
      description: 'Baskets, sandales, escarpins et chaussures traditionnelles',
      status: 'active',
      parentId: modeAccessoires.id,
      displayOrder: 3
    }
  });
  console.log(`  ✅ Catégorie: ${chaussures.name}`);

  const bijouxMontres = await db.category.upsert({
    where: { slug: 'bijoux-montres' },
    update: {},
    create: {
      name: 'Bijoux & Montres',
      slug: 'bijoux-montres',
      description: 'Colliers, bracelets, boucles d\'oreilles et montres',
      status: 'active',
      parentId: modeAccessoires.id,
      displayOrder: 4
    }
  });
  console.log(`  ✅ Catégorie: ${bijouxMontres.name}`);

  // --- Sous-catégories : alimentation ---
  const epicerieCondiments = await db.category.upsert({
    where: { slug: 'epicerie-condiments' },
    update: {},
    create: {
      name: 'Épicerie & Condiments',
      slug: 'epicerie-condiments',
      description: 'Riz, céréales, sauces, huiles et condiments',
      status: 'active',
      parentId: alimentation.id,
      displayOrder: 1
    }
  });
  console.log(`  ✅ Catégorie: ${epicerieCondiments.name}`);

  const boissonsOrAlimCat = await db.category.upsert({
    where: { slug: 'boissons' },
    update: {},
    create: {
      name: 'Boissons',
      slug: 'boissons',
      description: 'Jus naturels, bissap, gingembre, sodas et boissons locales',
      status: 'active',
      parentId: alimentation.id,
      displayOrder: 2
    }
  });
  console.log(`  ✅ Catégorie: ${boissonsOrAlimCat.name}`);

  const specialitesAfricaines = await db.category.upsert({
    where: { slug: 'specialites-africaines' },
    update: {},
    create: {
      name: 'Spécialités Africaines',
      slug: 'specialites-africaines',
      description: 'Attiéké, gari, fonio, soumbala et produits typiques',
      status: 'active',
      parentId: alimentation.id,
      displayOrder: 3
    }
  });
  console.log(`  ✅ Catégorie: ${specialitesAfricaines.name}`);

  // --- Sous-catégories : artisanat-exotique ---
  const artisanatCat = await db.category.upsert({
    where: { slug: 'artisanat-art' },
    update: {},
    create: {
      name: 'Artisanat & Art',
      slug: 'artisanat-art',
      description: 'Sculptures, masques, tableaux et objets décoratifs artisanaux',
      status: 'active',
      parentId: artisanatExotique.id,
      displayOrder: 1
    }
  });
  console.log(`  ✅ Catégorie: ${artisanatCat.name}`);

  const epicesCat = await db.category.upsert({
    where: { slug: 'epices-naturels' },
    update: {},
    create: {
      name: 'Épices & Produits Naturels',
      slug: 'epices-naturels',
      description: 'Épices rares, poudres, huiles essentielles et remèdes naturels',
      status: 'active',
      parentId: artisanatExotique.id,
      displayOrder: 2
    }
  });
  console.log(`  ✅ Catégorie: ${epicesCat.name}`);

  // Alias for karité product (uses epices-naturels as a natural products category)
  const beauteOrNaturelCat = epicesCat;

  // ===== UTILISATEUR ADMIN =====
  console.log('\n👤 Création de l\'utilisateur admin...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mandemarket.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@2024!';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminHash,
      name: 'Administrateur MandeMarket',
      role: 'admin',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: adminEmail,
      password: adminHash,
      name: 'Administrateur MandeMarket',
      role: 'admin',
      emailVerifiedAt: seedVerifiedAt,
    }
  });
  console.log(`  ✅ Admin: ${adminUser.email}`);

  // ===== UTILISATEUR MANAGER =====
  console.log('\n👤 Création du manager...');

  const managerHash = await bcrypt.hash('Manager@2024!', 12);
  const managerUser = await db.user.upsert({
    where: { email: 'manager@mandemarket.com' },
    update: {
      role: 'manager',
      password: managerHash,
      name: 'Manager MandeMarket',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: 'manager@mandemarket.com',
      password: managerHash,
      name: 'Manager MandeMarket',
      role: 'manager',
      emailVerifiedAt: seedVerifiedAt,
    }
  });
  console.log(`  ✅ Manager: ${managerUser.email} (role=manager)`);

  // ===== UTILISATEUR SUPPORT =====
  console.log('\n🎧 Création du compte support...');

  const supportEmail = process.env.SEED_SUPPORT_EMAIL || 'support@mandemarket.com';
  const supportPassword = process.env.SEED_SUPPORT_PASSWORD || 'Support@2024!';
  const supportHash = await bcrypt.hash(supportPassword, 12);
  const supportUser = await db.user.upsert({
    where: { email: supportEmail },
    update: {
      role: 'support',
      password: supportHash,
      name: 'Support MandeMarket',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: supportEmail,
      password: supportHash,
      name: 'Support MandeMarket',
      role: 'support',
      emailVerifiedAt: seedVerifiedAt,
    }
  });
  console.log(`  ✅ Support: ${supportUser.email} (role=support)`);

  // ===== VENDEUR =====
  console.log('\n🏪 Création du vendeur...');

  const sellerHash = await bcrypt.hash('Vendeur@2024!', 12);
  const sellerUser = await db.user.upsert({
    where: { email: 'vendeur@mandemarket.com' },
    update: {
      password: sellerHash,
      name: 'Aminata Koné',
      role: 'seller',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: 'vendeur@mandemarket.com',
      password: sellerHash,
      name: 'Aminata Koné',
      role: 'seller',
      emailVerifiedAt: seedVerifiedAt,
    }
  });

  const sellerProfile = await db.seller.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      storeName: 'Boutique Aminata',
      slug: 'boutique-aminata',
      description: 'Spécialiste en sacs et accessoires africains de qualité. Fabrication artisanale, matières nobles.',
      status: 'approved',
      commissionRate: 10
    }
  });
  console.log(`  ✅ Vendeur: ${sellerUser.email} → Boutique: ${sellerProfile.storeName}`);

  // Produits du vendeur
  const existingSellerProducts = await db.product.count({ where: { sellerId: sellerProfile.id } });
  if (existingSellerProducts === 0) {
    const sellerProducts = [
      {
        name: 'Sac tissé wax africain',
        price: 1500000, // 15000 FCFA
        description: 'Sac à main fabriqué à la main en tissu wax authentique. Motifs africains traditionnels, doublure coton, anses tressées.',
        categoryId: sacsCat.id,
        sellerId: sellerProfile.id,
        image: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=800&auto=format&fit=crop',
        stock: 20,
        status: 'active',
        colors: ['Rouge', 'Bleu', 'Vert'],
        styles: ['Artisanal', 'Africain'],
        condition: 'new'
      },
      {
        name: 'Pochette brodée cérémonie',
        price: 900000, // 9000 FCFA
        description: 'Pochette de cérémonie avec broderies à la main. Idéale pour mariages et baptêmes. Chaînette dorée amovible.',
        categoryId: sacsCat.id,
        sellerId: sellerProfile.id,
        image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop',
        stock: 15,
        status: 'active',
        colors: ['Or', 'Argent'],
        styles: ['Cérémonie', 'Artisanal'],
        condition: 'new'
      },
      {
        name: 'Porte-monnaie bogolan',
        price: 350000, // 3500 FCFA
        description: 'Porte-monnaie en tissu bogolan du Mali. Teinture végétale naturelle, couture main, fermeture pression.',
        categoryId: artisanatCat.id,
        sellerId: sellerProfile.id,
        image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop',
        stock: 40,
        status: 'active',
        colors: ['Marron', 'Beige'],
        styles: ['Artisanal', 'Africain'],
        condition: 'new'
      }
    ];

    for (const p of sellerProducts) {
      await db.product.create({ data: p });
      console.log(`  ✅ Produit vendeur: ${p.name} (${p.price / 100} FCFA)`);
    }
  } else {
    console.log(`  ℹ️  Produits vendeur déjà présents (${existingSellerProducts}), skip.`);
  }

  // ===== PRODUITS PLATEFORME =====
  const existingPlatformProducts = await db.product.count({ where: { sellerId: null } });

  if (existingPlatformProducts === 0) {
    console.log('\n📦 Création des produits plateforme...');

    const platformProducts = [
      {
        name: 'iPhone 15 Pro Max',
        price: 120000000, // 1 200 000 FCFA
        description: 'Apple iPhone 15 Pro Max 256GB. Puce A17 Pro, appareil photo 48MP, écran ProMotion 6.7". Neuf, débloqué tout opérateur.',
        categoryId: smartphonesCat.id,
        image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop',
        stock: 10,
        status: 'active',
        colors: ['Titane Naturel', 'Titane Noir', 'Titane Blanc'],
        brand: 'Apple',
        condition: 'new'
      },
      {
        name: 'Samsung Galaxy A54 5G',
        price: 32000000, // 320 000 FCFA
        description: 'Samsung Galaxy A54 5G 128GB. Écran Super AMOLED 6.4", batterie 5000mAh, triple caméra 50MP.',
        categoryId: smartphonesCat.id,
        image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop',
        stock: 25,
        status: 'active',
        colors: ['Blanc', 'Noir', 'Violet'],
        brand: 'Samsung',
        condition: 'new'
      },
      {
        name: 'Boubou brodé grand occasion',
        price: 3500000, // 35 000 FCFA
        description: 'Grand boubou en bazin riche brodé main. Tenue traditionnelle africaine de prestige, idéale pour cérémonies et mariages.',
        categoryId: vêtementsCat.id,
        image: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=800&auto=format&fit=crop',
        stock: 12,
        status: 'active',
        colors: ['Blanc', 'Bleu Royal', 'Or'],
        condition: 'new'
      },
      {
        name: 'Sac à main cuir premium',
        price: 2500000, // 25 000 FCFA
        description: 'Sac à main en cuir véritable de haute qualité. Confection artisanale avec finitions luxueuses. Idéal pour le bureau et les sorties élégantes.',
        categoryId: sacsCat.id,
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop',
        stock: 15,
        status: 'active',
        colors: ['Noir', 'Marron'],
        condition: 'new'
      },
      {
        name: 'Huile de coco vierge bio 500ml',
        price: 350000, // 3 500 FCFA
        description: 'Huile de coco 100% pure et naturelle, première pression à froid. Certifiée biologique, multi-usages : cuisine, soin capillaire et cutané.',
        categoryId: epicesCat.id,
        image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&auto=format&fit=crop',
        stock: 100,
        status: 'active',
        colors: [],
        condition: 'new'
      },
      {
        name: 'Bissap (Hibiscus) séché 500g',
        price: 150000, // 1 500 FCFA
        description: 'Fleurs d\'hibiscus séchées, qualité premium. Pour préparer le jus de bissap traditionnel, riche en vitamine C et antioxydants.',
        categoryId: boissonsOrAlimCat.id,
        image: 'https://images.unsplash.com/photo-1603569283847-aa295f0d016a?w=800&auto=format&fit=crop',
        stock: 200,
        status: 'active',
        colors: [],
        condition: 'new'
      },
      {
        name: 'Masque africain décoratif',
        price: 1800000, // 18 000 FCFA
        description: 'Masque en bois sculpté à la main par des artisans ivoiriens. Pièce unique, décoration murale ou collection. Livré avec son support.',
        categoryId: artisanatCat.id,
        image: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&auto=format&fit=crop',
        stock: 8,
        status: 'active',
        colors: ['Naturel'],
        condition: 'new'
      },
      {
        name: 'Laptop ASUS VivoBook 15',
        price: 55000000, // 550 000 FCFA
        description: 'ASUS VivoBook 15 - Intel Core i5, 8GB RAM, 512GB SSD, écran Full HD 15.6". Idéal études et bureautique. Windows 11 inclus.',
        categoryId: informatiqueOrElectroCat.id,
        image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop',
        stock: 7,
        status: 'active',
        colors: ['Gris Argenté'],
        brand: 'ASUS',
        condition: 'new'
      },
      {
        name: 'Karité pur beurre 250g',
        price: 200000, // 2 000 FCFA
        description: 'Beurre de karité 100% pur, non raffiné, origine Burkina Faso. Hydratant naturel intense pour peau, cheveux et lèvres.',
        categoryId: beauteOrNaturelCat.id,
        image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop',
        stock: 150,
        status: 'active',
        colors: [],
        condition: 'new'
      }
    ];

    for (const p of platformProducts) {
      await db.product.create({ data: p });
      console.log(`  ✅ Produit plateforme: ${p.name} (${p.price / 100} FCFA)`);
    }
  } else {
    console.log(`\n📦 ${existingPlatformProducts} produit(s) plateforme déjà présents, skip.`);
  }

  // ===== CLIENT AFRIQUE (CI) =====
  console.log('\n🛍️  Création des clients test...');

  const clientCiEmail = 'client@mandemarket.com';
  const clientCiPassword = 'Client@2024!';
  const clientCiHash = await bcrypt.hash(clientCiPassword, 12);
  const clientCiUser = await db.user.upsert({
    where: { email: clientCiEmail },
    update: {
      password: clientCiHash,
      name: 'Fatoumata Diallo',
      role: 'customer',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: clientCiEmail,
      password: clientCiHash,
      name: 'Fatoumata Diallo',
      role: 'customer',
      emailVerifiedAt: seedVerifiedAt,
    }
  });
  // Ce lien est requis par requireCustomerAuth et doit aussi être réparé
  // lors d'un nouveau seed sur une base déjà initialisée.
  const customer = await db.customer.upsert({
    where: { email: clientCiEmail },
    update: {
      userId: clientCiUser.id,
      firstName: 'Fatoumata',
      lastName: 'Diallo',
      phone: '+2250102030405',
      status: 'active',
    },
    create: {
      userId: clientCiUser.id,
      email: clientCiEmail,
      firstName: 'Fatoumata',
      lastName: 'Diallo',
      phone: '+2250102030405',
      status: 'active',
      address: {
        create: {
          street: '12 Rue du Commerce, Plateau',
          city: 'Abidjan',
          postalCode: '01 BP 1234',
          country: 'CI',
          isDefault: true
        }
      }
    }
  });
  console.log(`  ✅ Client CI: ${customer.email} (${customer.firstName} ${customer.lastName})`);

  // ===== CLIENT EUROPE (FR) =====
  const clientFrEmail = 'client.fr@mandemarket.com';
  const clientFrPassword = 'ClientFR@2024!';
  const clientFrHash = await bcrypt.hash(clientFrPassword, 12);
  const clientFrUser = await db.user.upsert({
    where: { email: clientFrEmail },
    update: {
      password: clientFrHash,
      name: 'Sophie Martin',
      role: 'customer',
      emailVerifiedAt: seedVerifiedAt,
    },
    create: {
      email: clientFrEmail,
      password: clientFrHash,
      name: 'Sophie Martin',
      role: 'customer',
      emailVerifiedAt: seedVerifiedAt,
    }
  });
  const customerFr = await db.customer.upsert({
    where: { email: clientFrEmail },
    update: {
      userId: clientFrUser.id,
      firstName: 'Sophie',
      lastName: 'Martin',
      phone: '+33612345678',
      status: 'active',
    },
    create: {
      userId: clientFrUser.id,
      email: clientFrEmail,
      firstName: 'Sophie',
      lastName: 'Martin',
      phone: '+33612345678',
      status: 'active',
      address: {
        create: {
          street: '42 Avenue des Champs-Élysées',
          city: 'Paris',
          postalCode: '75008',
          country: 'FR',
          isDefault: true
        }
      }
    }
  });
  console.log(`  ✅ Client FR: ${customerFr.email} (${customerFr.firstName} ${customerFr.lastName})`);

  // ===== RÉSUMÉ =====
  const totalProducts = await db.product.count();
  const totalCustomers = await db.customer.count();
  const totalUsers = await db.user.count();

  console.log('\n🎉 Seed terminé avec succès !');
  console.log('═══════════════════════════════════════');
  console.log('📊 RÉSUMÉ:');
  console.log(`  Catégories : 8 racines + 13 sous-catégories`);
  console.log(`  Produits   : ${totalProducts} (plateforme + vendeur)`);
  console.log(`  Utilisateurs : ${totalUsers} (admin + manager + support + vendeur + clients)`);
  console.log(`  Clients    : ${totalCustomers} (Afrique + Europe)`);
  console.log('═══════════════════════════════════════');
  console.log('🔑 ACCÈS ADMIN   : admin@mandemarket.com / Admin@2024!');
  console.log('🔑 ACCÈS MANAGER : manager@mandemarket.com / Manager@2024!');
  console.log(`🔑 ACCÈS SUPPORT : ${supportEmail} / ${supportPassword}`);
  console.log('🔑 ACCÈS VENDEUR : vendeur@mandemarket.com / Vendeur@2024!');
  console.log('🔑 CLIENT CI     : client@mandemarket.com / Client@2024!');
  console.log('🔑 CLIENT FR     : client.fr@mandemarket.com / ClientFR@2024!');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
