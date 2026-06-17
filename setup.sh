#!/bin/bash

echo "🏁 F1 Manager Tycoon 1970 - Setup Script"
echo ""

if [ ! -f .env ]; then
  echo "Creating .env file..."
  cp .env.example .env
  echo "✓ .env created. Edit it to customize settings."
else
  echo "✓ .env already exists"
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Generating Prisma client..."
npm run prisma:generate

echo ""
echo "✓ Setup complete!"
echo "Run 'npm start' to launch the game."
echo "Then open http://localhost:3000 in your browser."
