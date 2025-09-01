import { z } from "zod";

export const tweetId = z.string();
export const date = z.string().datetime();

/**
 * Schema for geographic coordinates.
 */
export const coordinatesSchema = z.strictObject({
  /**
   * An array of coordinates in [longitude, latitude] format.
   */
  coordinates: z.tuple([z.string(), z.string()]),
  /**
   * The type of geographic location, e.g., 'Point'.
   */
  type: z.literal("Point"),
});

/**
 * Schema for place information associated with a post.
 */
export const placeSchema = z.strictObject({
  /**
   * A record of additional attributes about the place.
   */
  attributes: z.record(z.any(), z.any()),
  /**
   * The bounding box for the place, defining its coordinates.
   */
  bounding_box: z.strictObject({
    /**
     * An array of arrays defining the bounding box. Each sub-array contains [longitude, latitude].
     */
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    /**
     * Type of bounding box geometry, e.g., 'Polygon'.
     */
    type: z.string(),
  }),
  /**
   * The country name.
   */
  country: z.string(),
  /**
   * The ISO country code.
   */
  country_code: z.string(),
  /**
   * The full name of the place.
   */
  full_name: z.string(),
  /**
   * The unique identifier for the place.
   */
  id: z.string(),
  /**
   * The short name of the place.
   */
  name: z.string(),
  /**
   * The type of place, e.g., 'city'.
   */
  place_type: z.string(),
  /**
   * A URL providing more details about the place.
   */
  url: z.string(),
});

/**
 * Schema for user information.
 */
export const userSchema = z.strictObject({
  /**
   * The unique identifier for the user.
   */
  id: z.number(),
  /**
   * The string representation of the user ID.
   */
  id_str: z.string(),
  /**
   * The name of the user.
   */
  name: z.string(),
  /**
   * The screen name (handle) of the user.
   */
  screen_name: z.string(),
  /**
   * The user's location, if provided.
   */
  location: z.string().optional(),
  /**
   * The URL associated with the user, if provided.
   */
  url: z.string().optional(),
  /**
   * A short bio or description of the user.
   */
  description: z.string().optional(),
  /**
   * Indicates whether the user is verified.
   */
  verified: z.boolean(),
  /**
   * The number of followers the user has.
   */
  followers_count: z.number(),
  /**
   * The number of accounts the user is following.
   */
  friends_count: z.number(),
  /**
   * The number of public lists that include the user.
   */
  listed_count: z.number(),
  /**
   * The number of posts the user has liked.
   */
  favourites_count: z.number(),
  /**
   * The total number of posts the user has made.
   */
  statuses_count: z.number(),
  /**
   * The date and time when the user account was created.
   */
  created_at: z.string(),
  /**
   * The user's UTC offset, if available.
   */
  utc_offset: z.number().optional(),
  /**
   * The user's time zone, if available.
   */
  time_zone: z.string().optional(),
  /**
   * Indicates whether the user has enabled geotagging.
   */
  geo_enabled: z.boolean(),
  /**
   * The language of the user's interface, if specified (BCP 47 format).
   */
  lang: z.string().optional(),
  /**
   * Indicates if the account supports contributors.
   */
  contributors_enabled: z.boolean(),
  /**
   * Indicates whether the user is marked as a translator.
   */
  is_translator: z.boolean(),
  /**
   * The URL of the user's profile image.
   */
  profile_image_url: z.string().optional(),
  /**
   * The HTTPS URL of the user's profile image.
   */
  profile_image_url_https: z.string(),
  /**
   * The URL of the user's profile banner image, if available.
   */
  profile_banner_url: z.string().optional(),
  /**
   * Indicates whether the user uses the default profile.
   */
  default_profile: z.boolean(),
  /**
   * Indicates whether the user uses the default profile image.
   */
  default_profile_image: z.boolean(),
  /**
   * Indicates whether the authenticating user follows this user.
   */
  following: z.boolean().optional(),
  /**
   * Indicates whether a follow request has been sent to this user.
   */
  follow_request_sent: z.boolean().optional(),
  /**
   * Indicates whether the authenticating user has notifications enabled for this user.
   */
  notifications: z.boolean().optional(),
});

/**
 * Schema for entities extracted from post text.
 */
export const entitiesSchema = z.strictObject({
  /**
   * Array of hashtags included in the post.
   */
	hashtags: z.strictObject({
		text: z.string(),
		indices: z.tuple([
			z.string(),
			z.string()
		]).optional(),
  }).array().optional(),
  /**
   * Array of symbols mentioned in the post.
   */
	symbols: z.strictObject({
	  text: z.string(),
		indices: z.tuple([
			z.string(),
			z.string()
	  ])
  }).array().optional(),
  /**
   * Array of user mentions in the post.
   */
  user_mentions: z.array(z.any()).optional(),
  /**
   * Array of URLs included in the post.
   */
  urls: z.array(
    z.strictObject({
      /**
       * The URL as it appears in the post.
       */
      url: z.string(),
      /**
       * The fully resolved URL.
       */
      expanded_url: z.string(),
      /**
       * The shortened display version of the URL.
       */
      display_url: z.string(),
      /**
       * Start and end indices of the URL in the post text.
       */
      indices: z.tuple([z.string(), z.string()]),
    })
  ).optional(),
  /**
   * Array of media objects included in the post, if any.
   */
  media: z.array(z.any()).optional(),
  /**
   * Array of polls included in the post, if any.
   */
  polls: z.array(z.any()).optional(),
});

/**
 * Schema for a post object.
 */
export const postSchema = z.strictObject({
	edit_info: z.strictObject({
		initial: z.strictObject({
			editTweetIds: z.string().array(),
			editableUntil: date,
			editsRemaining: z.string(),
			isEditEligible: z.boolean()
		})
	}),
  /**
   * The UTC time when the post was created.
   */
  created_at: z.string(),
  /**
   * The unique identifier for the post (integer format).
   */
  id: z.string(),
  /**
   * The unique identifier for the post (string format).
   */
  id_str: z.string(),
  /**
   * The actual text content of the post.
   */
  full_text: z.string(),
  favorited: z.boolean(),
  favorite_count: z.string().optional(),
  /**
   * Whether the tweet was withheld in some
   * countries for copyright reasons.
   *
   * See withheld_in_countries.
   */
  withheld_copyright: z.boolean().optional(),
  withheld_in_countries: z.string().array().optional(),
  possibly_sensitive: z.boolean().optional(),
	geo: coordinatesSchema.optional(),
  retweeted: z.boolean().optional(),
  lang: z.string().optional(),
  extended_entities: entitiesSchema.optional(),
	display_text_range: z.tuple([
		z.string(),
		z.string()
  ]).optional(),
  retweet_count: z.string().optional(),
  /**
   * The source utility used to post the content.
   */
  source: z.string(),
  /**
   * Indicates if the text was truncated due to length limits.
   */
  truncated: z.boolean(),
  /**
   * The ID of the original post this post is replying to (integer format).
   */
  in_reply_to_status_id: z.string().optional(),
  /**
   * The ID of the original post this post is replying to (string format).
   */
  in_reply_to_status_id_str: z.string().optional(),
  /**
   * The ID of the user this post is replying to (integer format).
   */
  in_reply_to_user_id: z.string().optional(),
  /**
   * The ID of the user this post is replying to (string format).
   */
  in_reply_to_user_id_str: z.string().optional(),
  /**
   * The screen name of the user this post is replying to.
   */
  in_reply_to_screen_name: z.string().optional(),
  /**
   * The user who posted this content.
   */
  user: userSchema.optional(),
  /**
   * Geographic location of the post, if available.
   */
  coordinates: coordinatesSchema.optional(),
  /**
   * Place information associated with the post.
   */
  place: placeSchema.optional(),
  /**
   * Entities parsed from the post text.
   */
  entities: entitiesSchema,
});

export const archivedTweetSchema = z.strictObject({
	tweet: postSchema
})
