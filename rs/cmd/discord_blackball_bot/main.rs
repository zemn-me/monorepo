use std::collections::HashSet;
use std::env;

use serenity::all::{parse_user_mention, EditRole, GuildId, UserId};
use serenity::{async_trait, FutureExt};
use serenity::model::channel::Message;
use serenity::prelude::*;

struct Handler;

#[derive(Debug)]
enum BotError {
    MissingInviteTarget,
    MissingGuildId,
    OnlyMembersCanElect,
}


impl Handler {
    async fn attempt_election(&self, ctx: Context, who: UserId) -> Result<()> {

    }

    async fn get_role_by_name(&self, ctx: Context, guild: GuildId, name: String) -> Result<Option<Role>> {
         Ok(guild.roles(&ctx.http).await?.into_iter()
            .find_map(|(rid, r)| {
                if r.name == name {
                    Ok(Some(r))
                }

                None
            }
        ));
    }

    async fn member(&self, ctx: Context, guild: GuildId) {
        self.must_role(ctx, guild, "member".into(), EditRole::new())
    }


    async fn applicant(&self, ctx: Context, guild: GuildId) {
        self.must_role(ctx, guild, "applicant".into(), EditRole::new())
    }

    async fn must_role(&self, ctx: Context, guild: GuildId,
    name: String, fallback: EditRole) -> Result<Role> {
        let x: Option<Role> = self.get_role_by_name(ctx, guild, name).await?
            .unwrap_or_else(|| guild.create_role(&ctx.http,
                fallback.name(name)
            ))?;

    }


    async fn setup_roles(&self, ctx: Context, guild: GuildId) -> Result<()> {

    }

    async fn handle_message(&self, ctx: Context, msg: Message) -> Result<()> {
        if !msg.content.starts_with("!elect") {
            return;
        }

        if !msg.author.has_role(&ctx.http, msg.guild_id, self.member(ctx, guild)) {
            return Err(BotError::OnlyMembersCanElect)
        }

        let target_user: UserId = msg.content.split_whitespace().nth(1)
            .and_then(|mention| parse_user_mention(mention))
            .unwrap_or(BotError::MissingInviteTarget)?;

        self.attempt_election(ctx, target_user)
    }

    async fn n_members(&self, ctx: Context, guild: GuildId) -> Result<u64> {
        guild.members(
            &ctx.http,
            None,
            None,
        ).await?.into_iter().count()
    }

    async fn n_sponsors(&self, ctx: Context, n_members: u64) -> Result<u64> {
        match n_members {
            n if n < 5 => 1,
            _ => 2
        }
    }

    /// Calculate the number of votes needed to elect a new member.
    async fn quorum(&self, ctx: Context, n_members: u64) -> Result<u64> {
        // at least 12 members are needed if there are more than
        // 12 members in the club, otherwise all members must vote.
        match n_members {
            n if n < 12 => n,
            _ => 12
        }
    }

    /// how many black balls at minimum are required to reject an election.
    async fn n_balls_exclude(&self, ctx: Context, ballot_size: u64) -> Result<u64> {
        if ballot_size > 18 {
            2
        }

        1
    }
}

#[async_trait]
impl EventHandler for Handler {
    async fn message(&self, ctx: Context, msg: Message) {
        match self.handle_message(ctx, msg) {
            Ok => (),
            Err(e) => msg.channel_id.say(&ctx.http, e).await {
                println!("Error sending message: {why?:}")
            },
        }
    }
}

#[tokio::main]
async fn main() {
    // Login with a bot token from the environment
    let token = env::var("DISCORD_TOKEN").expect("Expected a token in the environment");
    // Set gateway intents, which decides what events the bot will be notified about
    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT;

    // Create a new instance of the Client, logging in as a bot.
    let mut client = Client::builder(&token, intents)
        .event_handler(Handler)
        .await
        .expect("Err creating client");

    // Start listening for events by starting a single shard
    if let Err(why) = client.start().await {
        println!("Client error: {why:?}");
    }
}
