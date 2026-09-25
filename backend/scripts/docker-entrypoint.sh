#!/bin/sh
set -e

echo "========================================"
echo "MandeMarket Backend - Démarrage Docker"
echo "========================================"

# Fonction pour attendre un service avec timeout
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=${4:-60}

    echo "Attente de $service_name ($host:$port)..."

    local count=0
    while ! nc -z "$host" "$port" 2>/dev/null; do
        count=$((count + 1))
        if [ $count -gt $timeout ]; then
            echo "ERREUR: Timeout - $service_name n'est pas accessible après ${timeout}s"
            echo "Vérifiez que le service $service_name est démarré"
            exit 1
        fi

        if [ $((count % 10)) -eq 0 ]; then
            echo "   ... tentative $count/$timeout"
        fi
        sleep 1
    done

    echo "OK: $service_name est prêt !"
}

# Vérifier les variables d'environnement critiques
echo "Vérification des variables d'environnement..."

if [ -z "$DATABASE_URL" ]; then
    echo "ERREUR: DATABASE_URL n'est pas défini"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERREUR: JWT_SECRET n'est pas défini"
    exit 1
fi

echo "OK: Variables d'environnement vérifiées"

# Détecter les noms d'hôtes depuis les variables d'env ou les URLs
DB_HOST=${DB_HOST:-postgres}
REDIS_HOST=${REDIS_HOST:-redis}

# Extraction depuis DATABASE_URL si présent
if [ -n "$DATABASE_URL" ]; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
fi

if [ -n "$REDIS_URL" ]; then
    REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p' | sed 's/:.*//')
fi

echo "Connexion à: DB=$DB_HOST, Redis=$REDIS_HOST"

# Attendre PostgreSQL
wait_for_service "$DB_HOST" "5432" "PostgreSQL" 90

# Attendre Redis (seulement si REDIS_URL est défini)
if [ -n "$REDIS_URL" ]; then
    wait_for_service "$REDIS_HOST" "6379" "Redis" 60
fi

# Attente supplémentaire pour s'assurer que PostgreSQL est vraiment prêt
echo "Attente supplémentaire pour PostgreSQL (5s)..."
sleep 5

# Créer les dossiers nécessaires
mkdir -p /app/uploads /app/logs /app/tmp

# Appliquer les migrations Prisma de façon stricte et non-destructive
echo "Application des migrations Prisma (migrate deploy)..."
if [ "${RUN_MIGRATIONS:-true}" = "false" ] || npx --no-install prisma migrate deploy; then
    echo "OK: Migrations Prisma appliquées avec succès"
else
    echo "ERREUR CRITIQUE: Échec de 'prisma migrate deploy'. Arrêt immédiat pour protéger les données."
    exit 1
fi

# Seed optionnel (seulement si SEED_DATA=true)
if [ "$SEED_DATA" = "true" ] && [ "$NODE_ENV" = "production" ]; then
    echo "ERROR: SEED_DATA is forbidden in production"
    exit 1
fi
if [ "$SEED_DATA" = "true" ]; then
    echo "SEED_DATA=true - Exécution du seed..."
    node scripts/seed.js 2>/dev/null || echo "Seed optionnel ignoré"
fi

echo "Configuration terminée - Démarrage de MandeMarket Backend..."
echo "Port: ${PORT:-4002} | Environnement: ${NODE_ENV:-production}"
echo "========================================"

exec "$@"
