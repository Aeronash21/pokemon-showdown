# Pokéngine sprite integration

The ND Shared Power server does not control Pokémon battle sprite files.

Pokémon Showdown uses a separate client repository, and its `/sprites/`
resources are not part of the server repository.

Pokéngine also assigns usage permissions individually to resources.
Its public-use categories include:

- Free to Use With Credit
- Free to Use Within Pokéngine
- Ask for Permission
- Do Not Use

For that reason this repository intentionally does not scrape/rehost
Pokéngine sprites automatically.

To complete the visual replacement:

1. Fork pokemon-showdown-client.
2. Select only Pokéngine assets whose permission allows external use.
3. Preserve the creator credits required by each asset.
4. Create a PS species/form-ID -> asset mapping for Gen 6+, Megas,
   Gigantamax formes, and other requested transformations.
5. Change the client battle sprite resolver to use those resources.
6. Build/host that client and connect it to this server.

Pokéngine:
https://pokengine.org/

Policy:
https://www.pokengine.org/legal/public-use-policy
