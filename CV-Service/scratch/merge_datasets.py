import os
import shutil
import glob

base_path = r"c:\Users\rama_\Desktop\BuildSphere Project\Buildsphere-Mobile\CV-Service\datasets"
target_dirs = ["train", "valid", "test"]
sub_dirs = ["images", "labels"]

# Versions in order of priority (higher version overwrites lower)
versions = [
    "Find glass panels.v7-continuous-improvement-2026-04-25.yolov8",
    "Find glass panels.v8-continuous-improvement-2026-04-25.yolov8",
    "Find glass panels.v10-continuous-improvement-2026-04-25.yolov8 (1)"
]

def merge_data():
    for version in versions:
        version_path = os.path.join(base_path, version)
        if not os.path.exists(version_path):
            print(f"Warning: {version_path} does not exist. Skipping.")
            continue
            
        print(f"Merging {version}...")
        
        for t_dir in target_dirs:
            for s_dir in sub_dirs:
                src = os.path.join(version_path, t_dir, s_dir)
                dst = os.path.join(base_path, t_dir, s_dir)
                
                if not os.path.exists(src):
                    continue
                
                if not os.path.exists(dst):
                    os.makedirs(dst, exist_ok=True)
                
                files = os.listdir(src)
                for f in files:
                    src_file = os.path.join(src, f)
                    dst_file = os.path.join(dst, f)
                    
                    # Copy and overwrite (higher versions come later in the list)
                    shutil.copy2(src_file, dst_file)

    print("Merging complete!")

if __name__ == "__main__":
    merge_data()
