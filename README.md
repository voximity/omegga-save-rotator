# omegga-save-rotator

Automatically rotate out saves on an interval or on a percentage of user votes.

## Installation

To use with Omegga, ensure you are in your Omegga installation directory and run the following commands:

`cd plugins`

`git clone git://github.com/voximity/omegga-save-rotator.git`

On the Omegga web interface, go to the plugins menu, click "Reload Plugins", and click the refresh icon above the list of plugins.
The Save Rotator will appear in the list.

### Configuring the Save Rotator

The Save Rotator has 4 configuration options:

- `saves`: A list of comma-separated save file names (without the `.brs`) that the Save Rotator will rotate between. If the field is left blank, the Save Rotator will rotate between all of the saves in data/Saved/Builds.
- `rotate-on-interval`: A number representing the number of seconds to wait each time before rotating the map again. If the field is zero, the map will not automatically rotate.
- `wait-after-clearing`: A number representing how many seconds to wait after clearing before loading another map. For smooth minigame integration,
it is recommended to set this to 5-10 seconds and add water to allow players to drown before the next map loads in.
- `enable-vote-rocking`: If on, players will be able to use the `!rtv` command to vote to rotate the map.
- `percentage-rtv-to-rotate`: A number between 0 and 1 representing the percentage of players required to vote to rotate the map. For example, when at 0.5, 50% of the server is required to `!rtv` to rotate the map.

When you have configured the Save Rotator to your liking, click the yellow Reload button at the bottom. The plugin will reload and your settings will be in effect.