---
title: "One Flake to Rule Them All"
description: Managing a laptop, desktop, and a production server from a single declarative config — and the rabbit hole that led me here.
date: 2026-04-25
duration: 12 min
tag: NixOS, linux, nix
---

### A little backstory

Every time I set up a new Linux machine it goes the same way. Install the distro, run `apt install` or `pacman -S` on everything I can remember, forget half the packages until I actually need them, copy-paste dotfiles from some older machine hoping they still work, and spend the next two weeks fixing whatever broke. It's tedious. And the worst part is it never feels reproducible — two machines that are *supposed* to be configured the same are never quite the same after a few months of drift.

That was roughly my life before NixOS. My laptop was my daily driver and I had a separate VPS running some personal projects. Both were running different distros, both had their own pile of configs that diverged from each other the moment I started tweaking things. Eventually I fell into the NixOS rabbit hole and never really climbed back out.

This post is about that experience — what NixOS is, how I set things up across multiple machines, and the parts that genuinely surprised me (both good and bad).

---

### What even is Nix

Before anything else, a quick explainer because "Nix" gets used to mean a few different things depending on context.

**Nix** is a purely functional package manager and build system. The core idea is that every package gets its own isolated slot in `/nix/store`, identified by a hash derived from its source, dependencies, build instructions, and environment. So two versions of the same package — or the same version built with different dependencies — are completely separate entries:

```
/nix/store/
├── a1b2c3d4-python-3.11.5/
├── f9e8d7c6-python-3.12.1/
└── 9x8w7v6u-nodejs-20.11.0/
```

Nothing ever overwrites anything. If an upgrade fails halfway, your old package is untouched. You can roll back instantly. This immutability is what makes NixOS actually reliable in a way other distros aren't — you can `nixos-rebuild switch` and if something breaks you can boot the previous generation from GRUB. It's like having Git for your entire OS.

**NixOS** is a Linux distribution built entirely around this concept. Instead of imperatively running commands to configure your system, you declare what you want in `.nix` files and the system reconciles itself to match. Want nginx running? `services.nginx.enable = true;`. Want pipewire instead of pulseaudio? A few lines. The whole system state — packages, services, users, filesystems — lives in version-controlled configuration files.

**Nix Flakes** is an experimental (but effectively standard at this point) feature that adds a proper dependency management layer on top. A `flake.nix` defines your inputs (other flakes, like nixpkgs) and your outputs (your system configurations). A `flake.lock` pins exact commit hashes for all inputs so builds are fully reproducible. Think of it like `package.json` + `package-lock.json`, but for your entire system.

**Home Manager** is a companion tool that handles user-level configuration — shell, editor, dotfiles, per-user packages — using the same declarative approach. So instead of `~/.zshrc` being some handcrafted thing you drag between machines, it's generated from Nix config that lives in your repo.

That's the stack. Now for what I actually did with it.

---

### The setup

My current flake manages three active hosts:

| Host | Machine | Role |
|---|---|---|
| `nixos` | Laptop | Daily driver, NixOS single boot |
| `nixos-box` | Desktop | Dev + gaming machine |
| `nixos-server` | VPS | Production server |

There's also a `gce-nixos-asia-southeast1-a` that I set up on Google Cloud for my bachelor thesis. That's been idle since I submitted, but the config is still in the repo — commented out, collecting dust, kind of like my thesis itself.

The `flake.nix` is the single entry point for all of them. One of the things I really appreciate about flakes is being able to juggle multiple nixpkgs channels cleanly. My setup uses three:

```nix
inputs = {
  nixpkgs.url         = "github:NixOS/nixpkgs/nixos-24.11";
  nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
  nixpkgs-6e99f2a2.url = "github:nixos/nixpkgs/6e99f2a27d600612004fbd2c3282d614bfee6421";
  home-manager = {
    url = "github:nix-community/home-manager/release-24.11";
    inputs.nixpkgs.follows = "nixpkgs";
  };
  disko.url = "github:nix-community/disko";
  disko.inputs.nixpkgs.follows = "nixpkgs";
};
```

- `nixpkgs` (stable 24.11) — the base for everything
- `nixpkgs-unstable` — for packages that I want the latest version of, like `neovim` and `opencode`
- `nixpkgs-6e99f2a2` — a pinned commit, specifically because `firefoxpwa` needs an older nixpkgs version that doesn't break on it

All three get passed into every host via `specialArgs`:

```nix
let
  pkgs       = import nixpkgs        { inherit system; config.allowUnfree = true; };
  upkgs      = import nixpkgs-unstable { inherit system; config.allowUnfree = true; };
  pinnedPkgs = import nixpkgs-6e99f2a2 { inherit system; config.allowUnfree = true; };

  specialArgs = { inherit pkgs upkgs pinnedPkgs; };
in
```

So inside any host config I can just grab from whichever channel makes sense: `upkgs.neovim`, `pkgs.git`, `pinnedPkgs.firefoxpwa`. Clean.

---

### Home Manager

Home Manager sits inside each host definition and manages the user-level stuff — shell config, editor setup, git, tmux, and so on. The nice thing is that shared config lives in `home-manager/` and each host's `home.nix` just imports what it needs.

The laptop and desktop share most things (zsh, neovim, git, lazygit, tmux, alacritty, fzf, direnv) but diverge on a few things — the desktop has a heavier GNOME dconf config, a different wallpaper, and more gaming-related tools. The server's home config is leaner: neovim, git, zsh, tmux, fzf. No desktop, no GUI anything.

One quirk worth mentioning: when I first added Home Manager to machines that already had dotfiles, it refused to proceed because it would've needed to overwrite existing files. The fix was `backupFileExtension = "backup"` in the home-manager config block, which tells it to rename conflicts rather than bail. Learned that the fun way.

---

### The interesting parts

#### The server: nginx as a declaration

Before NixOS, my VPS's nginx config was a mess of manually edited `sites-available` files. Now the entire reverse proxy setup lives in `hosts/server/services/nginx/default.nix`. Here's a slice of it:

```nix
services.nginx = {
  recommendedGzipSettings  = true;
  recommendedOptimisation   = true;
  recommendedProxySettings  = true;
  recommendedTlsSettings    = true;
  serverTokens = false;
  virtualHosts = {
    "hidayattaufiqur.dev"       = { locations."/" = { proxyPass = "http://localhost:1977"; }; };
    "n8n.hidayattaufiqur.dev"   = { locations."/" = { proxyPass = "http://127.0.0.1:5678"; /* ... */ }; };
    "fno.hidayattaufiqur.dev"   = { locations."/" = { proxyPass = "http://127.0.0.1:5000"; /* ... */ }; };
    "blogablog.hidayattaufiqur.dev" = { locations."/" = { proxyPass = "http://127.0.0.1:4000"; }; };
    "notionmcp.hidayattaufiqur.dev" = {
      forceSSL    = true;
      enableACME  = true;
      locations."/" = { proxyPass = "http://127.0.0.1:6969"; /* ... */ };
    };
    # ... and more
  };
};
```

`security.acme.acceptTerms = true;` and `enableACME = true;` is all I need for Let's Encrypt certs on any vhost. No certbot, no cron, no `--standalone` flag anxiety.

The custom apps running behind nginx — `fno-navigator` and `mc-management` — are also defined as systemd units in the same repo. So adding a new service means writing a `.nix` file, not SSHing in and creating a systemd unit by hand.

#### Minecraft, declaratively

At some point I decided to run a Minecraft server on the VPS. With NixOS, this is just a systemd unit in `hosts/server/services/systemd/mc.nix`:

```nix
systemd.services.mc-server = {
  description = "Minecraft Spigot Server";
  after       = [ "network.target" ];
  wantedBy    = [ "multi-user.target" ];

  serviceConfig = {
    Type             = "simple";
    User             = "nixos-server";
    WorkingDirectory = "/home/nixos-server/Fun/mc-server";
    ExecStart        = "${pkgs.jdk}/bin/java -Xmx2G -Xms1G -jar server.jar nogui";
    Restart          = "on-failure";
    RestartSec       = "5s";
    KillSignal       = "SIGINT";
    TimeoutStopSec   = "120s";
  };
};
```

Geyser Bedrock support is just opening the right ports:

```nix
networking.firewall.allowedUDPPorts = [ 19132 25565 25575 ]; # Geyser
networking.firewall.allowedTCPPorts = [ 25565 25575 ];       # Minecraft + RCON
```

It's running. I can rebuild the server config and the Minecraft service stays correctly defined without me needing to remember any of this.

#### Monitoring stack

Prometheus, node exporter, and Grafana are all in the same flake. The server scrapes itself every 5 seconds, Grafana listens on port 2342, and it's proxied behind nginx at `tools.hidayattaufiqur.dev/grafana/`. All of it is roughly a dozen lines of Nix. I'm not going to claim I set this up from scratch — I mostly imported the service modules and pointed them at each other — but the fact that it's *in the repo* means I can reproduce it or tear it down without hunting through some half-remembered DigitalOcean tutorial.

#### Desktop: overrides and pinning

The desktop host is where the more interesting package management stuff happens. Two examples:

**Steam with `libgdiplus`** — some games that run under Proton need this. In nixpkgs, Steam doesn't include it by default, so you override it:

```nix
nixpkgs.overlays = [
  (final: prev: {
    steam = prev.steam.override ({ extraPkgs ? pkgs': [], ... }: {
      extraPkgs = pkgs': (extraPkgs pkgs') ++ (with pkgs'; [ libgdiplus ]);
    });
  })
];
```

**Postman pinned to a web archive snapshot** — the current version of Postman in nixpkgs requires a newer Electron than what was available when I needed it. The solution was to fetch an archived version directly:

```nix
postman = prev.postman.overrideAttrs(old: rec {
  version = "20240205183313";
  src = final.fetchurl {
    url    = "https://web.archive.org/web/${version}/https://dl.pstmn.io/download/latest/linux_64";
    sha256 = "sha256-svk60K4pZh0qRdx9+5OUTu0xgGXMhqvQTGTcmqBOMq8=";
    name   = "${old.pname}-${version}.tar.gz";
  };
});
```

It's a bit hacky but it works, and because it's pinned to a specific archive snapshot the build is reproducible. There's also `nixpkgs.config.permittedInsecurePackages` involved since this pulls in `electron-12.2.3`, which nixpkgs considers insecure. `¯\_(ツ)_/¯`

**GNOME extensions across two channels** — the desktop runs GNOME with a bunch of extensions (tiling-assistant, blur-my-shell, dash-to-dock, space-bar, cronomix, etc.). The problem is that some extensions only work with specific GNOME versions, and the unstable channel sometimes ships an extension version that's incompatible with the stable GNOME. One commit in my git history is literally `fix(gnome): move tiling-assistant extension to stable package channel` — that was a morning wasted figuring out why my workspace tiling was broken after an update.

**Waydroid** — Android emulation on the desktop is literally one line:

```nix
virtualisation.waydroid.enable = true;
```

I haven't used it much, but it's there and it works.

#### Disko: declarative disk partitioning

The VPS uses [disko](https://github.com/nix-community/disko) to manage disk layout declaratively. The actual config describes a GPT disk with an EFI partition and an LVM volume group:

```nix
disko.devices = {
  disk.disk1 = {
    device  = lib.mkDefault "/dev/sda";
    type    = "disk";
    content = {
      type       = "gpt";
      partitions = {
        boot = { size = "1M"; type = "EF02"; };
        esp  = { size = "500M"; type = "EF00";
                 content = { type = "filesystem"; format = "vfat"; mountpoint = "/boot"; }; };
        root = { size = "100%"; content = { type = "lvm_pv"; vg = "pool"; }; };
      };
    };
  };
  lvm_vg.pool = {
    type = "lvm_vg";
    lvs.root = {
      size    = "100%FREE";
      content = { type = "filesystem"; format = "ext4"; mountpoint = "/"; };
    };
  };
};
```

The useful thing about this is that you can use `nixos-anywhere` to deploy from a known disk config to a fresh machine over SSH. No clicking through an installer. I haven't had to reprovision the VPS yet but knowing I could do it in one command is reassuring.

#### nix-ld: the unpatched binary escape hatch

NixOS doesn't follow the Filesystem Hierarchy Standard — binaries live in `/nix/store` instead of `/usr/bin` — which means a lot of precompiled binaries just refuse to run because they can't find their dynamic linker. `nix-ld` fixes this by providing a fake `/lib/ld-linux.so.2` that redirects to the real one.

I have it enabled with a handful of common libraries:

```nix
programs.nix-ld.enable = true;
programs.nix-ld.libraries = with pkgs; [
  curl openssl gcc-unwrapped stdenv.cc.cc zlib
];
```

This mostly exists so that `pip install` and similar tools don't immediately explode. It's not a perfect solution but it covers the 90% case.

---

### Where things went wrong (honestly)

No experience post is complete without the parts that didn't go smoothly.

**Fonts.** My rofi launcher was broken for a bit because the font path I referenced in the config didn't exist on the rebuilt system. The commit is literally `fix(rofi): fonts not found` and `fix(rofi): change imported font and color paths`. Rofi's theming relies on paths that I assumed were stable but weren't after switching themes. Nothing dramatic, just an annoying debugging session.

**AMD GPU packages.** At some point I had `amdvlk` in the desktop config and it started breaking things after an update. The fix was `fix(desktop): comment out amdvlk packages` and just leaving it commented out. I don't fully understand what it conflicted with — AMD GPU support on NixOS via Mesa is fine without it, so I didn't dig further.

**Home Manager file conflicts.** The first time I ran home-manager on a machine that already had dotfiles, it errored out because it would've clobbered existing `~/.zshrc` and friends. Enabling `backupFileExtension = "backup"` is the right move and it's in the docs, but it's not immediately obvious why the switch failed the first time.

**GNOME extension version mismatches.** Already mentioned above, but it's worth emphasizing: GNOME extensions are very sensitive to the GNOME shell version. If you're on nixpkgs stable for GNOME but pulling extensions from unstable, you will occasionally hit breakage. Keeping `tiling-assistant` on the stable channel specifically was a lesson I had to learn through a broken desktop.

**SOPS secrets: blocked.** I've been meaning to add proper secrets management for a while. The plan involves `sops-nix` to handle things like the Cloudflare tunnel credentials and the Minecraft management app's env file. The config, the age keys, and the encrypted secrets file are already in the repo. The blocker is that `buildGo125Module`, which `sops-nix` needs for one of its dependencies, isn't in nixpkgs 24.11 stable — it landed in unstable. So either I bump the entire flake to unstable, or I wait for the next stable release. It's fully documented in `PLANS.md` and I keep not doing it. Classic.

---

### What's next

Beyond SOPS, there are a couple of things I want to clean up:

- **Cloudflared** — the service definition is already written in `services/cloudflared.nix` but intentionally left out of the imports until SOPS is sorted. Once secrets are handled properly, this gets uncommented.
- **Declarative PostgreSQL databases and users** — right now the PostgreSQL service is enabled but the databases and roles are created manually. That's the kind of thing that gets lost if I ever have to reprovision.
- The GCE instance config is still in the repo, technically. If I ever need another cloud instance for something (thesis 2: electric boogaloo), it'll be a `nixosConfigurations` entry away.

---

### TLDR

NixOS lets you describe your entire system — packages, services, users, disk layout, dotfiles — as code that lives in a Git repo. One `nixos-rebuild switch` and the machine matches the config. Roll back with GRUB if something breaks. Managing three machines from a single flake means my laptop, desktop, and VPS all share the same config foundation with host-specific additions, and rebuilding any of them from scratch is a known quantity rather than a vague anxiety.

The learning curve is real and the rough edges exist, but after living with it for a while I can't imagine going back to a normal distro for any machine I care about.

---

### Resources

- [NixOS Search](https://search.nixos.org/packages?channel=unstable) — first stop for any package
- [NixOS Wiki](https://wiki.nixos.org/wiki/NixOS_Wiki)
- [Home Manager options](https://home-manager-options.extranix.com/) — much easier than reading the source
- [Vimjoyer on YouTube](https://www.youtube.com/@vimjoyer/videos) — genuinely the best practical NixOS content
- [Zero to Nix (DeterminateSystems)](https://zero-to-nix.com/) — solid intro
- [NixOS & Flakes Book](https://nixos-and-flakes.thiscute.world/) — unofficial but very good
- [disko](https://github.com/nix-community/disko) — declarative disk partitioning
- [nix-community/awesome-nix](https://github.com/nix-community/awesome-nix) — curated list of everything
