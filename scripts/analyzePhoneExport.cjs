const fs = require('fs');
const path = require('path');

class PhoneExportAnalyzer {
  constructor(exportPath) {
    this.exportPath = exportPath;
    this.data = null;
    this.analysis = {};
  }

  loadExportData() {
    try {
      const rawData = fs.readFileSync(this.exportPath, 'utf-8');
      this.data = JSON.parse(rawData);
      console.log(`📱 Loaded export: ${this.data.words.length} words`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load export:', error.message);
      return false;
    }
  }

  analyzeProgressData() {
    if (!this.data) return null;

    const words = this.data.words;
    
    // Basic progress distribution
    const exposureLevels = {};
    const wordsWithProgress = words.filter(w => w.timesStudied > 0);
    const wordsWithoutProgress = words.filter(w => !w.timesStudied || w.timesStudied === 0);

    words.forEach(word => {
      const level = word.exposureLevel || 'new';
      exposureLevels[level] = (exposureLevels[level] || 0) + 1;
    });

    // Accuracy analysis
    const accuracyData = wordsWithProgress.map(word => ({
      spanish: word.spanish,
      english: word.english,
      accuracy: word.timesStudied > 0 ? (word.timesCorrect / word.timesStudied) : 0,
      attempts: word.timesStudied,
      exposureLevel: word.exposureLevel,
      frequencyRank: word.frequencyRank || 99999,
      lastStudied: word.lastStudied
    })).sort((a, b) => a.accuracy - b.accuracy);

    return {
      totalWords: words.length,
      wordsWithProgress: wordsWithProgress.length,
      wordsWithoutProgress: wordsWithoutProgress.length,
      exposureLevels,
      accuracyData,
      strugglingWords: accuracyData.filter(w => w.attempts >= 3 && w.accuracy < 0.6),
      masteredWords: accuracyData.filter(w => w.accuracy === 1.0 && w.attempts >= 2),
      averageAccuracy: wordsWithProgress.length > 0 
        ? wordsWithProgress.reduce((sum, w) => sum + (w.timesCorrect / w.timesStudied), 0) / wordsWithProgress.length 
        : 0
    };
  }

  analyzeFrequencyEffectiveness() {
    const wordsWithProgress = this.data.words.filter(w => w.timesStudied > 0 && w.frequencyRank);
    
    const frequencyBuckets = {
      veryHigh: wordsWithProgress.filter(w => w.frequencyRank <= 500),
      high: wordsWithProgress.filter(w => w.frequencyRank > 500 && w.frequencyRank <= 1500),
      medium: wordsWithProgress.filter(w => w.frequencyRank > 1500 && w.frequencyRank <= 5000),
      low: wordsWithProgress.filter(w => w.frequencyRank > 5000)
    };

    const analyzeBucket = (bucket, name) => {
      if (bucket.length === 0) return null;
      
      const avgAccuracy = bucket.reduce((sum, w) => sum + (w.timesCorrect / w.timesStudied), 0) / bucket.length;
      const avgAttempts = bucket.reduce((sum, w) => sum + w.timesStudied, 0) / bucket.length;
      const strugglingCount = bucket.filter(w => w.timesStudied >= 3 && (w.timesCorrect / w.timesStudied) < 0.6).length;
      
      return {
        name,
        count: bucket.length,
        avgAccuracy: Math.round(avgAccuracy * 100),
        avgAttempts: Math.round(avgAttempts * 10) / 10,
        strugglingPercentage: Math.round((strugglingCount / bucket.length) * 100),
        examples: bucket.slice(0, 3).map(w => ({
          spanish: w.spanish,
          accuracy: Math.round((w.timesCorrect / w.timesStudied) * 100),
          attempts: w.timesStudied
        }))
      };
    };

    return {
      veryHighFreq: analyzeBucket(frequencyBuckets.veryHigh, 'Very High (1-500)'),
      highFreq: analyzeBucket(frequencyBuckets.high, 'High (501-1500)'),
      mediumFreq: analyzeBucket(frequencyBuckets.medium, 'Medium (1501-5000)'),
      lowFreq: analyzeBucket(frequencyBuckets.low, 'Low (5000+)')
    };
  }

  analyzeExposureProgression() {
    const wordsWithProgress = this.data.words.filter(w => w.timesStudied > 0);
    
    // Time to reach each exposure level
    const progressionData = {
      toLearning: [],
      toFamiliar: [],
      toMastered: []
    };

    wordsWithProgress.forEach(word => {
      if (word.exposureLevel === 'learning' && word.timesStudied > 0) {
        progressionData.toLearning.push(word.timesStudied);
      } else if (word.exposureLevel === 'familiar' && word.timesStudied > 0) {
        progressionData.toFamiliar.push(word.timesStudied);
      } else if (word.exposureLevel === 'mastered' && word.timesStudied > 0) {
        progressionData.toMastered.push(word.timesStudied);
      }
    });

    const getStats = (arr) => {
      if (arr.length === 0) return null;
      const sorted = arr.sort((a, b) => a - b);
      return {
        count: arr.length,
        average: Math.round((arr.reduce((sum, n) => sum + n, 0) / arr.length) * 10) / 10,
        median: sorted[Math.floor(sorted.length / 2)],
        min: sorted[0],
        max: sorted[sorted.length - 1]
      };
    };

    return {
      learning: getStats(progressionData.toLearning),
      familiar: getStats(progressionData.toFamiliar),
      mastered: getStats(progressionData.toMastered)
    };
  }

  analyzeStudyPatterns() {
    const wordsWithProgress = this.data.words.filter(w => w.timesStudied > 0 && w.lastStudied);
    
    if (wordsWithProgress.length === 0) return null;

    // Recent activity (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentWords = wordsWithProgress.filter(w => w.lastStudied > sevenDaysAgo);
    
    // Study frequency distribution
    const studyDistribution = {};
    wordsWithProgress.forEach(word => {
      const attempts = word.timesStudied;
      studyDistribution[attempts] = (studyDistribution[attempts] || 0) + 1;
    });

    return {
      totalStudiedWords: wordsWithProgress.length,
      recentActivity: recentWords.length,
      studyDistribution,
      oldestStudy: Math.min(...wordsWithProgress.map(w => w.lastStudied)),
      newestStudy: Math.max(...wordsWithProgress.map(w => w.lastStudied))
    };
  }

  generateInsights() {
    const progress = this.analyzeProgressData();
    const frequency = this.analyzeFrequencyEffectiveness();
    const progression = this.analyzeExposureProgression();
    const patterns = this.analyzeStudyPatterns();

    const insights = [];
    const recommendations = [];

    // Progress insights
    if (progress.wordsWithProgress > 0) {
      const progressPercentage = Math.round((progress.wordsWithProgress / progress.totalWords) * 100);
      insights.push(`📊 You've actively studied ${progress.wordsWithProgress} words (${progressPercentage}% of your vocabulary)`);
      
      if (progress.averageAccuracy > 0.8) {
        insights.push(`🎯 Strong overall accuracy: ${Math.round(progress.averageAccuracy * 100)}%`);
      } else if (progress.averageAccuracy < 0.6) {
        insights.push(`⚠️ Lower accuracy (${Math.round(progress.averageAccuracy * 100)}%) suggests need for algorithm tuning`);
        recommendations.push('Consider adjusting difficulty progression thresholds');
      }

      if (progress.strugglingWords.length > 0) {
        const strugglingPercentage = Math.round((progress.strugglingWords.length / progress.wordsWithProgress) * 100);
        insights.push(`🔄 ${progress.strugglingWords.length} words (${strugglingPercentage}%) need extra attention`);
        
        if (strugglingPercentage > 25) {
          recommendations.push('High percentage of struggling words - review these for clarity or add mnemonics');
        }
      }
    }

    // Frequency effectiveness insights
    if (frequency.veryHighFreq && frequency.highFreq) {
      const highFreqAccuracy = (frequency.veryHighFreq.avgAccuracy + frequency.highFreq.avgAccuracy) / 2;
      if (highFreqAccuracy > 75) {
        insights.push(`✨ Algorithm working well: ${highFreqAccuracy}% accuracy on high-frequency words`);
      } else {
        insights.push(`🔧 High-frequency words struggling (${highFreqAccuracy}% accuracy) - algorithm may need adjustment`);
        recommendations.push('Focus more on high-frequency word repetition');
      }
    }

    // Progression insights
    if (progression.familiar && progression.familiar.average) {
      insights.push(`📈 Average ${progression.familiar.average} attempts to reach 'familiar' level`);
      
      if (progression.familiar.average > 6) {
        recommendations.push('Words taking too long to progress - consider easier exposure thresholds');
      }
    }

    return { insights, recommendations };
  }

  generateDetailedReport() {
    console.log('\n🔍 ANALYZING YOUR VOCABULARY LEARNING DATA...\n');
    
    const progress = this.analyzeProgressData();
    const frequency = this.analyzeFrequencyEffectiveness();
    const progression = this.analyzeExposureProgression();
    const patterns = this.analyzeStudyPatterns();
    const insights = this.generateInsights();

    // Header
    console.log('='.repeat(60));
    console.log('📱 PHONE EXPORT ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`Export Date: ${this.data.exportDate}`);
    console.log(`Total Words: ${progress.totalWords.toLocaleString()}`);
    console.log(`Words with Learning Progress: ${progress.wordsWithProgress.toLocaleString()}`);
    console.log('');

    // Progress Overview
    console.log('📊 LEARNING PROGRESS OVERVIEW');
    console.log('-'.repeat(40));
    Object.entries(progress.exposureLevels).forEach(([level, count]) => {
      const percentage = Math.round((count / progress.totalWords) * 100);
      console.log(`${level.padEnd(10)}: ${count.toLocaleString().padStart(6)} (${percentage}%)`);
    });
    console.log(`Average Accuracy: ${Math.round(progress.averageAccuracy * 100)}%`);
    console.log('');

    // Frequency Effectiveness
    console.log('🎯 FREQUENCY-BASED ALGORITHM EFFECTIVENESS');
    console.log('-'.repeat(40));
    Object.values(frequency).forEach(bucket => {
      if (bucket) {
        console.log(`${bucket.name.padEnd(20)}: ${bucket.count} words, ${bucket.avgAccuracy}% accuracy, ${bucket.avgAttempts} avg attempts`);
      }
    });
    console.log('');

    // Progression Analysis
    console.log('📈 EXPOSURE LEVEL PROGRESSION');
    console.log('-'.repeat(40));
    if (progression.learning) {
      console.log(`To Learning Level: ${progression.learning.average} avg attempts (${progression.learning.count} words)`);
    }
    if (progression.familiar) {
      console.log(`To Familiar Level: ${progression.familiar.average} avg attempts (${progression.familiar.count} words)`);
    }
    if (progression.mastered) {
      console.log(`To Mastered Level: ${progression.mastered.average} avg attempts (${progression.mastered.count} words)`);
    }
    console.log('');

    // Struggling Words
    if (progress.strugglingWords.length > 0) {
      console.log('⚠️  TOP STRUGGLING WORDS');
      console.log('-'.repeat(40));
      progress.strugglingWords.slice(0, 10).forEach(word => {
        const freqInfo = word.frequencyRank < 99999 ? ` (rank ${word.frequencyRank})` : '';
        console.log(`${word.spanish.padEnd(15)} - ${word.english.substring(0, 25).padEnd(25)} | ${word.accuracy * 100}% in ${word.attempts} tries${freqInfo}`);
      });
      console.log('');
    }

    // Key Insights
    console.log('💡 KEY INSIGHTS');
    console.log('-'.repeat(40));
    insights.insights.forEach(insight => console.log(`• ${insight}`));
    console.log('');

    // Recommendations
    console.log('🚀 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    insights.recommendations.forEach(rec => console.log(`• ${rec}`));
    
    if (insights.recommendations.length === 0) {
      console.log('• Algorithm appears to be working well! Keep up the current approach.');
    }
    console.log('');

    return {
      progress,
      frequency,
      progression,
      patterns,
      insights: insights.insights,
      recommendations: insights.recommendations
    };
  }

  exportAnalysisData(outputPath) {
    const analysis = this.generateDetailedReport();
    const exportData = {
      analysisDate: new Date().toISOString(),
      sourceExport: this.data.exportDate,
      totalWords: this.data.words.length,
      ...analysis
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📄 Analysis exported to: ${outputPath}`);
    return exportData;
  }
}

// Main execution
async function runAnalysis() {
  const exportPath = path.join(__dirname, '..', 'public', 'phone_export.json');
  const outputPath = path.join(__dirname, '..', 'analysis_results.json');
  
  const analyzer = new PhoneExportAnalyzer(exportPath);
  
  if (analyzer.loadExportData()) {
    const analysis = analyzer.generateDetailedReport();
    analyzer.exportAnalysisData(outputPath);
    
    console.log('\n✅ Analysis complete! Review the insights above and check analysis_results.json for detailed data.');
  } else {
    console.log('\n❌ Could not load phone export. Please ensure phone_export.json exists in the public folder.');
  }
}

// Run if called directly
if (require.main === module) {
  runAnalysis();
}

module.exports = { PhoneExportAnalyzer };