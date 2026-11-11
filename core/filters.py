"""
Candidate filtering functions for skills, location, and experience.
Provides post-search filtering to refine results based on job requirements.
"""

from typing import List, Dict, Any
from utils.utils import get_logger

logger = get_logger(__name__)

def _get(candidate: Dict[str, Any], key: str, default=None):
    """Look up a field at top-level first, then inside 'metadata'.

    The hybrid indexer returns flat dicts (key at top level), while the
    vector store returns nested dicts (key inside 'metadata').  This helper
    handles both shapes so filters work regardless of source.
    """
    if key in candidate:
        return candidate[key]
    return candidate.get('metadata', {}).get(key, default)


def filter_by_skills(candidates: List[Dict[str, Any]], required_skills: List[str]) -> List[Dict[str, Any]]:
    """Filter candidates who have all required skills"""
    if not required_skills:
        return candidates

    filtered_candidates = []

    for candidate in candidates:
        candidate_skills = _get(candidate, 'skills', [])
        skills_lower = [cs.lower() for cs in candidate_skills]
        has_required = all(
            skill.lower() in skills_lower for skill in required_skills
        )

        if has_required:
            filtered_candidates.append(candidate)

    return filtered_candidates


def filter_by_location(candidates: List[Dict[str, Any]], target_locations: List[str]) -> List[Dict[str, Any]]:
    """Filter candidates by target locations (case-insensitive partial match)"""
    if not target_locations:
        return candidates

    filtered_candidates = []

    for candidate in candidates:
        candidate_location = (_get(candidate, 'location', '') or '').lower()
        location_match = any(
            loc.lower() in candidate_location for loc in target_locations
        )

        if location_match:
            filtered_candidates.append(candidate)

    return filtered_candidates


def filter_by_experience(candidates: List[Dict[str, Any]], min_experience: float) -> List[Dict[str, Any]]:
    """Filter candidates who meet minimum experience requirement"""
    if min_experience is None:
        return candidates

    filtered_candidates = []

    for candidate in candidates:
        candidate_experience = _get(candidate, 'experience')

        if candidate_experience is None:
            continue

        if candidate_experience >= min_experience:
            filtered_candidates.append(candidate)

    return filtered_candidates


def apply_filters(
    candidates: List[Dict[str, Any]], 
    required_skills: List[str] = None,
    target_locations: List[str] = None,
    min_experience: float = None
) -> List[Dict[str, Any]]:
    """Apply all filters (skills, location, experience) to candidate list"""
    filtered_candidates = candidates
    
    if required_skills:
        filtered_candidates = filter_by_skills(filtered_candidates, required_skills)
    
    if target_locations:
        filtered_candidates = filter_by_location(filtered_candidates, target_locations)
    
    if min_experience is not None:
        filtered_candidates = filter_by_experience(filtered_candidates, min_experience)
    
    return filtered_candidates