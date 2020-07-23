import * as core from "@actions/core";
import * as github from "@actions/github";
import { getOption } from "./option";
import { getConfigFromFile } from "./config";
import { listCommits } from "./commit";
import { getLatestRelease, createRelease } from "./release";
import { listPullRequests } from "./pull_request";
import { calculateChanges } from "./calculate";
import { calculateNextVersion } from "./version";
import { echoCurrentBranch, pushVersionBranch } from "./git";

async function run() {
    try {
        const option = getOption();
        const config = getConfigFromFile(option.configPath);
        const client = github.getOctokit(option.githubToken);

        const currentBranch = await echoCurrentBranch();
        if (currentBranch != config.branch.baseBranch) {
            throw new Error(`current branch(${currentBranch}) is not base branch(${config.branch.baseBranch})`);
        }

        let commits = await listCommits(config);
        const latestRelease = await getLatestRelease(client, option);
        if (latestRelease != null) {
            const index = commits.map((x) => x.sha).indexOf(latestRelease.commitSha);
            if (0 < index) {
                commits = commits.slice(0, index);
            }
        }
        const commitAndPullRequests = await listPullRequests(client, option, config, commits);
        const changes = calculateChanges(commitAndPullRequests);
        const nextVersion = calculateNextVersion(option, config, latestRelease, changes);

        await pushVersionBranch(option, config, nextVersion);
        const createdReleaseJson = await createRelease(client, option, config, nextVersion, changes);
        core.setOutput("release", createdReleaseJson);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
