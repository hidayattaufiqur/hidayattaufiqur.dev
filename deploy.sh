#!/run/current-system/sw/bin/zsh
echo "changing dir..."
cd Fun/Projects/vitesse

echo "pulling from repo..."
git stash
git pull
git stash pop

echo "injecting .env..."
mv env .env

echo "init/installing deps using poetry..."
nix develop --command bash -c "npm install"

echo "building astro project..."
nix develop --command bash -c "npm run build"

echo "restarting systemd unit..."
sudo systemctl restart hidayattaufiqurDev

echo "systemd unit status..."
sudo systemctl status hidayattaufiqurDev

echo "done!!!"
