const fs = require('fs');
const path = require('path');

const JOBS_FILE = path.join(__dirname, 'seen-jobs.json');
const HOURS_48 = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

class JobTracker {
  constructor() {
    this.seenJobs = this.loadSeenJobs();
  }

  /**
   * Load seen jobs from file
   */
  loadSeenJobs() {
    try {
      if (fs.existsSync(JOBS_FILE)) {
        const data = fs.readFileSync(JOBS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading seen jobs:', error.message);
    }
    return {};
  }

  /**
   * Save seen jobs to file
   */
  saveSeenJobs() {
    try {
      fs.writeFileSync(JOBS_FILE, JSON.stringify(this.seenJobs, null, 2));
    } catch (error) {
      console.error('Error saving seen jobs:', error.message);
    }
  }

  /**
   * Check if a job has been seen before
   */
  hasSeenJob(jobId) {
    return this.seenJobs.hasOwnProperty(jobId);
  }

  /**
   * Mark a job as seen
   */
  markJobAsSeen(jobId, jobData) {
    // Build proper URL - ciphertext already has the ~ prefix
    const jobUrl = jobData.ciphertext 
      ? `https://www.upwork.com/jobs/${jobData.ciphertext}`
      : `https://www.upwork.com/jobs/~${jobData.id}`;
    
    this.seenJobs[jobId] = {
      seenAt: new Date().toISOString(),
      postedAt: jobData.createdDateTime,
      title: jobData.title,
      url: jobUrl
    };
  }

  /**
   * Filter jobs to only include new ones (not seen before)
   */
  filterNewJobs(jobs) {
    return jobs.filter(job => !this.hasSeenJob(job.node.id));
  }

  /**
   * Filter jobs to only include those from the past 48 hours
   */
  filterRecent48Hours(jobs) {
    const cutoffTime = Date.now() - HOURS_48;
    return jobs.filter(job => {
      const postedTime = new Date(job.node.createdDateTime).getTime();
      return postedTime >= cutoffTime;
    });
  }

  /**
   * Clean up old jobs (older than 48 hours)
   */
  cleanupOldJobs() {
    const cutoffTime = Date.now() - HOURS_48;
    let removedCount = 0;

    Object.keys(this.seenJobs).forEach(jobId => {
      const job = this.seenJobs[jobId];
      const postedTime = new Date(job.postedAt).getTime();
      
      if (postedTime < cutoffTime) {
        delete this.seenJobs[jobId];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old jobs (older than 48 hours)`);
      this.saveSeenJobs();
    }
  }

  /**
   * Process jobs: filter, mark as seen, and return stats
   */
  processJobs(jobs) {
    // First clean up old jobs (removes jobs older than 48 hours from tracking)
    this.cleanupOldJobs();

    // Filter to only NEW jobs we haven't seen before
    const newJobs = this.filterNewJobs(jobs);

    // Mark all new jobs as seen
    newJobs.forEach(job => {
      this.markJobAsSeen(job.node.id, job.node);
    });

    // Save the updated seen jobs
    this.saveSeenJobs();

    return {
      totalJobs: jobs.length,
      newJobs: newJobs.length,
      alreadySeen: jobs.length - newJobs.length,
      jobs: newJobs
    };
  }

  /**
   * Get statistics about tracked jobs
   */
  getStats() {
    return {
      totalTracked: Object.keys(this.seenJobs).length,
      oldestJob: this.getOldestJob(),
      newestJob: this.getNewestJob()
    };
  }

  getOldestJob() {
    const jobs = Object.values(this.seenJobs);
    if (jobs.length === 0) return null;
    return jobs.reduce((oldest, job) => {
      return new Date(job.postedAt) < new Date(oldest.postedAt) ? job : oldest;
    });
  }

  getNewestJob() {
    const jobs = Object.values(this.seenJobs);
    if (jobs.length === 0) return null;
    return jobs.reduce((newest, job) => {
      return new Date(job.postedAt) > new Date(newest.postedAt) ? job : newest;
    });
  }
}

module.exports = JobTracker;
