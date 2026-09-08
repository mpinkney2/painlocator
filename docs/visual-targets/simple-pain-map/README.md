# Simple pain-map visual target

Reference mockup for the simplified PainLocator pain-chart interface:

![Reference mockup](./reference-mockup.png)

## Locked color palette (sampled from mockup)

| Token | Hex | Use |
| --- | --- | --- |
| Warm white | `#FEFBFA` | Page / header background |
| Navy | `#182A42` | Text, brand, **Save pain map** |
| Amber | `#F9B847` | Selected chips, active view, slider fill/thumb, brand dot |
| Amber marker | `#F4AE37` | Pain pin on body |
| Muted | `#A8AEB8` | Secondary labels (“Pain 1”, slider ends) |
| Border | `#D0D4DB` | Unselected chips / view buttons / note field |
| Track | `#E6E8ED` | Slider empty track |
| White | `#FFFFFF` | Surfaces, unselected controls |

## Layout decisions

- Body map left, describe form right (stack on mobile)
- Headline: “Show where it hurts.”
- View control: Front / Back / Left / Right under the body
- Form: Pain N + location title, intensity, Aching / Sharp / Burning, optional note, navy **Save pain map**
- Additional descriptors under “More descriptions”
- Current Spatial body geometry retained (no new vendors)
