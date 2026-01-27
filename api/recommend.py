from http.server import BaseHTTPRequestHandler
import json
import math
from collections import Counter

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Read Input
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            input_data = json.loads(post_data)

            users = input_data.get('users', [])
            destinations = input_data.get('destinations', [])

            if not users or not destinations:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps([]).encode())
                return

            # ==========================================
            # A. BUILD GROUP PROFILE
            # ==========================================
            # Calculate Budget (Standard Math)
            valid_max = [float(u['budget_max']) for u in users if u.get('budget_max') is not None]
            avg_max_budget = sum(valid_max) / len(valid_max) if valid_max else 5000

            # Build Profile Tags
            group_tags = []
            for u in users:
                acts = u.get('preferred_activities') or []
                types = u.get('preferred_types') or []

                # Clean strings
                if isinstance(acts, str): 
                    acts = acts.replace('[','').replace(']','').replace('"','').split(',')
                if isinstance(types, str): 
                    types = types.replace('[','').replace(']','').replace('"','').split(',')

                group_tags.extend([str(x).strip().lower() for x in acts if x])
                group_tags.extend([str(x).strip().lower() for x in types if x])

            # If empty, add defaults
            if not group_tags:
                group_tags = ["nature", "city", "relax"]
            
            # Create a Frequency Vector for the Group
            group_vec = Counter(group_tags)

            # ==========================================
            # B. MATH ENGINE (Manual Cosine Similarity)
            # ==========================================
            scored_destinations = []

            for dest in destinations:
                # 1. Build Destination Vector
                d_type = (dest.get('type') or "").lower()
                d_state = (dest.get('state') or "").lower()
                d_name = (dest.get('name') or "").lower()
                
                # Combine words
                dest_text = f"{d_type} {d_state} {d_name}"
                dest_tokens = dest_text.split()
                dest_vec = Counter(dest_tokens)

                # 2. Calculate Cosine Similarity
                # Formula: (A . B) / (||A|| * ||B||)
                
                # Get all unique words in both
                all_words = set(group_vec.keys()) | set(dest_vec.keys())
                
                dot_product = 0
                mag_group = 0
                mag_dest = 0
                
                for word in all_words:
                    a = group_vec.get(word, 0)
                    b = dest_vec.get(word, 0)
                    dot_product += a * b
                    
                # Calculate magnitude (only need to do group once technically, but fine here)
                mag_group = math.sqrt(sum(val**2 for val in group_vec.values()))
                mag_dest = math.sqrt(sum(val**2 for val in dest_vec.values()))

                if mag_group * mag_dest == 0:
                    similarity = 0
                else:
                    similarity = dot_product / (mag_group * mag_dest)

                # 3. Budget Bonus
                price = float(dest.get('price_min') or 0)
                if price <= (avg_max_budget * 1.2):
                    similarity += 0.1

                # Store result
                # Copy destination and add similarity
                dest_result = dest.copy()
                dest_result['similarity'] = similarity
                scored_destinations.append(dest_result)

            # ==========================================
            # C. SORT & RESPONSE
            # ==========================================
            # Sort by similarity descending
            scored_destinations.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Take Top 10
            top_10 = scored_destinations[:10]

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(top_10).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())