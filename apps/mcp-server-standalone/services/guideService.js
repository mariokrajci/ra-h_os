'use strict';

const skillService = require('./skillService');

module.exports = {
  listGuides: skillService.listSkills,
  readGuide: skillService.readSkill,
  writeGuide: skillService.writeSkill,
  deleteGuide: skillService.deleteSkill,
};
