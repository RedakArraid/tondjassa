export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  content: string[];
}

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: 'Comment choisir le sac à main parfait pour chaque occasion',
    excerpt: "Découvrez nos conseils d'experts pour sélectionner le sac idéal selon vos besoins et votre style de vie.",
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&h=800&fit=crop',
    category: 'Conseils',
    author: 'Marie Kouassi',
    date: '15 Oct 2024',
    readTime: '5 min',
    content: [
      'Un bon sac doit accompagner votre journée sans vous encombrer. Commencez par lister ce que vous transportez réellement : téléphone, portefeuille, ordinateur, documents ou accessoires.',
      'Pour le travail, privilégiez une structure solide, une fermeture fiable et des compartiments accessibles. Pour une cérémonie, une pochette légère suffit généralement et met davantage la tenue en valeur.',
      'Vérifiez enfin les finitions, les coutures et le confort des anses. Les fiches produits MandeMarket précisent les dimensions et les matières pour vous aider à comparer.',
    ],
  },
  {
    id: 2,
    title: 'Tendances sacs à main 2024 : Les must-have de la saison',
    excerpt: 'Explorez les dernières tendances en matière de sacs à main et découvrez les styles qui font sensation cette année.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=800&fit=crop',
    category: 'Tendances',
    author: 'Sophie Diallo',
    date: '10 Oct 2024',
    readTime: '7 min',
    content: [
      'Les formats compacts, les couleurs naturelles et les détails artisanaux restent faciles à associer au quotidien. Les pièces en wax ou en bogolan apportent quant à elles une identité forte à une tenue sobre.',
      'La tendance la plus durable reste toutefois le choix d’un modèle polyvalent : bandoulière réglable, poche intérieure et matière résistante permettent de le porter plus souvent et plus longtemps.',
      'Choisissez une tendance qui correspond à votre usage plutôt qu’un modèle uniquement photogénique. Un produit bien choisi garde sa valeur et évite les achats impulsifs.',
    ],
  },
  {
    id: 3,
    title: 'Entretien et soin de vos sacs en cuir : Guide complet',
    excerpt: 'Apprenez les meilleures techniques pour préserver la beauté et la durabilité de vos sacs en cuir premium.',
    image: 'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=1200&h=800&fit=crop',
    category: 'Entretien',
    author: 'Jean-Paul Touré',
    date: '5 Oct 2024',
    readTime: '6 min',
    content: [
      'Dépoussiérez le cuir avec un chiffon doux et sec. Testez toujours un produit d’entretien sur une zone peu visible avant de l’appliquer sur toute la surface.',
      'Évitez une exposition prolongée à l’eau, au soleil et aux sources de chaleur. Si le sac est humide, laissez-le sécher naturellement et conservez sa forme avec du papier non imprimé.',
      'Rangez le sac dans une housse respirante, sans le comprimer. Un entretien léger mais régulier est préférable à un nettoyage agressif occasionnel.',
    ],
  },
  {
    id: 4,
    title: "L'histoire de MandeMarket : Une passion ivoirienne",
    excerpt: "Découvrez l'histoire de notre marque et notre engagement envers la qualité et l'excellence en Côte d'Ivoire.",
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=800&fit=crop',
    category: 'À propos',
    author: 'Direction MandeMarket',
    date: '1 Oct 2024',
    readTime: '4 min',
    content: [
      'MandeMarket est née de la volonté de rendre les produits et savoir-faire africains plus accessibles, tout en donnant aux vendeurs des outils simples pour développer leur activité.',
      'La marketplace réunit dans un même espace le catalogue, la commande, le paiement et le suivi. Chaque évolution vise à renforcer la confiance entre clients, vendeurs et équipe de support.',
      'Notre ambition est de faciliter le commerce local et régional avec une expérience claire, sécurisée et adaptée aux réalités de chaque marché.',
    ],
  },
];

export function getBlogPost(id: string | number) {
  return blogPosts.find((post) => post.id === Number(id));
}
